import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { rebuild } from '@electron/rebuild';
import { build } from 'esbuild';
import { z } from 'zod';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).default({}),
  optionalDependencies: z.record(z.string(), z.string()).default({}),
});
const external = [
  'better-sqlite3',
  '@parcel/watcher',
  'trash',
  'bufferutil',
  'utf-8-validate',
];

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
  return z
    .string()
    .parse(createRequire(join(root, 'apps/desktop/package.json'))('electron'));
}

async function manifest(directory: string) {
  return manifestSchema.parse(
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
  await rebuild({
    buildPath: directory,
    electronVersion,
    arch: process.arch,
    onlyModules: ['better-sqlite3'],
    force: true,
  });
  await writeFile(stamp, `${JSON.stringify(wanted)}\n`);
}

export async function stageDesktop(stage: {
  directory: string;
  productName: string;
  web: boolean;
}): Promise<{ electronVersion: string }> {
  const desktop = await manifest(join(root, 'apps/desktop'));
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
    `${JSON.stringify({ name: desktop.name, productName: stage.productName, version: desktop.version, type: 'module', main: 'desktop/main.mjs', dependencies }, null, 2)}\n`,
  );
  await stageNativeModules(stage.directory, electronVersion, dependencies);
  return { electronVersion };
}
