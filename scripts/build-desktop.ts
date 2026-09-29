import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';
import { rebuild } from '@electron/rebuild';
import { build } from 'esbuild';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist/desktop');
const stage = join(output, 'stage');
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

export async function buildDesktop(): Promise<string> {
  if (process.platform !== 'darwin')
    throw new Error('Build the local Mac app on macOS');
  if (process.arch !== 'arm64' && process.arch !== 'x64')
    throw new Error('The Mac app requires arm64 or x64');
  const desktop = await manifest(join(root, 'apps/desktop'));
  const electronVersion = desktop.dependencies.electron;
  if (electronVersion === undefined)
    throw new Error('Pin Electron in apps/desktop/package.json');
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await desktopCommand('pnpm', [
    '--filter',
    '@porcelain/web',
    'exec',
    'vite',
    'build',
    '--mode',
    'desktop',
    '--outDir',
    join(stage, 'web'),
    '--emptyOutDir',
  ]);
  const banner = {
    js: "import { createRequire as porcelainRequire } from 'node:module'; const require = porcelainRequire(import.meta.url);",
  };
  await build({
    entryPoints: [join(root, 'apps/desktop/src/main.ts')],
    outfile: join(stage, 'desktop/main.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['electron'],
    banner,
  });
  await build({
    entryPoints: [join(root, 'apps/desktop/src/server.ts')],
    outfile: join(stage, 'server/src/bootstrap/server.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: ['electron', ...external],
    banner,
  });
  await cp(
    join(root, 'packages/storage/drizzle'),
    join(stage, 'server/drizzle'),
    { recursive: true },
  );
  const server = await manifest(join(root, 'apps/server'));
  const dependencies: Record<string, string> = {};
  for (const name of external) {
    const version = server.dependencies[name];
    if (version === undefined) continue;
    dependencies[name] = version;
    await vendor(
      name,
      join(root, 'apps/server'),
      join(stage, 'node_modules'),
      new Set(),
    );
  }
  await writeFile(
    join(stage, 'package.json'),
    `${JSON.stringify({ name: desktop.name, productName: 'Porcelain', version: desktop.version, type: 'module', main: 'desktop/main.mjs', dependencies }, null, 2)}\n`,
  );
  await rebuild({
    buildPath: stage,
    electronVersion,
    arch: process.arch,
    onlyModules: ['better-sqlite3'],
    force: true,
  });
  const packaged = await packager({
    dir: stage,
    name: 'Porcelain',
    executableName: 'Porcelain',
    platform: 'darwin',
    arch: process.arch,
    electronVersion,
    appBundleId: 'com.fabiofiorita.porcelain',
    appCategoryType: 'public.app-category.developer-tools',
    asar: { unpack: '**/{*.node,macos-trash}' },
    prune: false,
    out: output,
    overwrite: true,
    osxSign: {
      identity: '-',
      identityValidation: false,
      optionsForFile: () => ({ hardenedRuntime: false }),
    },
    extendInfo: {
      NSLocalNetworkUsageDescription:
        'Porcelain can share your projects with devices you pair on your local network.',
    },
  });
  const directory = packaged[0];
  if (directory === undefined)
    throw new Error('Electron packaging produced no Mac app');
  const app = join(directory, 'Porcelain.app');
  await desktopCommand('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    app,
  ]);
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`Built ${await buildDesktop()}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Mac app build failed'}\n`,
    );
    process.exitCode = 1;
  }
}
