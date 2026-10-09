import { Schema, Effect } from 'effect';
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';
export const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const manifestSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.optional(Schema.String),
  dependencies: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
  optionalDependencies: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
});
const external = ['@parcel/watcher', 'trash', 'bufferutil', 'utf-8-validate'];
export async function desktopCommand(command: string, args: readonly string[]) {
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', rejectCommand);
    child.once('close', (code) => {
      if (code === 0) resolveCommand();
      else rejectCommand(new Error(`${command} exited with ${code}`));
    });
  });
}
export function electronExecutable(): string {
  return Schema.decodeUnknownSync(Schema.String)(
    createRequire(join(root, 'apps/desktop/package.json'))('electron'),
  );
}
async function manifest(directory: string) {
  return Schema.decodeUnknownSync(manifestSchema)(
    JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')),
  );
}
function locate(name: string, from: string): string | undefined {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json')))
      return realpathSync(candidate);
    if (dirname(directory) === directory) return undefined;
  }
}
async function vendor(
  name: string,
  from: string,
  into: string,
  ancestry: ReadonlySet<string>,
) {
  const source = locate(name, from);
  if (source === undefined)
    throw new Error(`Missing runtime dependency: ${name}`);
  if (ancestry.has(source))
    throw new Error(`Cyclic runtime dependency: ${name}`);
  const destination = join(into, name);
  await cp(source, destination, {
    recursive: true,
    dereference: true,
    filter: (path) => !path.endsWith('/node_modules'),
  });
  const dependencies = await manifest(source);
  const visited = new Set([...ancestry, source]);
  for (const dependency of Object.keys(dependencies.dependencies))
    await vendor(
      dependency,
      source,
      join(destination, 'node_modules'),
      visited,
    );
  for (const dependency of Object.keys(dependencies.optionalDependencies))
    if (locate(dependency, source) !== undefined)
      await vendor(
        dependency,
        source,
        join(destination, 'node_modules'),
        visited,
      );
}
async function stageNativeModules(
  directory: string,
  electronVersion: string,
  dependencies: Record<string, string>,
) {
  const modules = join(directory, 'node_modules');
  const stamp = join(modules, '.porcelain-electron.json');
  const wanted = {
    electronVersion,
    platform: process.platform,
    arch: process.arch,
    dependencies,
  };
  const staged: unknown = existsSync(stamp)
    ? JSON.parse(await readFile(stamp, 'utf8'))
    : undefined;
  if (isDeepStrictEqual(staged, wanted)) return;
  await rm(modules, { recursive: true, force: true });
  for (const name of Object.keys(dependencies))
    await vendor(name, join(root, 'apps/server'), modules, new Set());
  await writeFile(stamp, `${JSON.stringify(wanted)}\n`);
}
export async function stageDesktop(stage: {
  directory: string;
  productName: string;
  web: boolean;
}): Promise<{ electronVersion: string }> {
  const desktop = await manifest(join(root, 'apps/desktop'));
  const { version } = await manifest(root);
  if (version === undefined)
    throw new Error('Set the release version in the root package.json');
  const electronVersion = desktop.dependencies.electron;
  if (electronVersion === undefined)
    throw new Error('Pin Electron in apps/desktop/package.json');
  await mkdir(stage.directory, { recursive: true });
  await rm(join(stage.directory, 'web'), { recursive: true, force: true });
  if (stage.web)
    await desktopCommand('pnpm', [
      '--filter',
      '@porcelain/web',
      'exec',
      'vite',
      'build',
      '--mode',
      'desktop',
      '--outDir',
      join(stage.directory, 'web'),
      '--emptyOutDir',
    ]);
  const banner = {
    js: "import { createRequire as porcelainRequire } from 'node:module'; const require = porcelainRequire(import.meta.url);",
  };
  await build({
    entryPoints: [join(root, 'apps/desktop/src/preload.ts')],
    outfile: join(stage.directory, 'desktop/preload.cjs'),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    external: ['electron'],
  });
  await build({
    entryPoints: [join(root, 'apps/desktop/src/main.ts')],
    outfile: join(stage.directory, 'desktop/main.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['electron'],
    banner,
  });
  await build({
    entryPoints: [join(root, 'apps/desktop/src/server.ts')],
    outfile: join(stage.directory, 'server/src/bootstrap/server.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['electron', ...external],
    banner,
  });
  await rm(join(stage.directory, 'server/drizzle'), {
    recursive: true,
    force: true,
  });
  await cp(
    join(root, 'packages/storage/drizzle'),
    join(stage.directory, 'server/drizzle'),
    { recursive: true },
  );
  const server = await manifest(join(root, 'apps/server'));
  const dependencies: Record<string, string> = {};
  for (const name of external) {
    const version = server.dependencies[name];
    if (version !== undefined) dependencies[name] = version;
  }
  await writeFile(
    join(stage.directory, 'package.json'),
    `${JSON.stringify({ name: desktop.name, productName: stage.productName, version, type: 'module', main: 'desktop/main.mjs', dependencies }, null, 2)}\n`,
  );
  await stageNativeModules(stage.directory, electronVersion, dependencies);
  return { electronVersion };
}
