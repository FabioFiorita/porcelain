import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { CommandRunner } from './command-runner.ts';
import { RuntimeInstallError } from './errors/runtime-install-error.ts';
import { RuntimeNativeModulesError } from './errors/runtime-native-modules-error.ts';
import { RuntimeVersionMismatchError } from './errors/runtime-version-mismatch-error.ts';
import { readJsonFile } from './json-file.ts';
import { packageManifestSchema } from './records.ts';

export const PACKAGE_NAME = '@fabiofiorita/porcelain';

const NATIVE_MODULES_LOAD = [
  "const load = require('node:module').createRequire(process.argv[1]);",
  'try {',
  "  const { DatabaseSync } = load('node:sqlite');",
  "  const database = new DatabaseSync(':memory:');",
  "  database.prepare('select 1').get();",
  '  database.close();',
  "  load('@parcel/watcher');",
  '} catch (error) {',
  '  process.stderr.write(String(error?.message ?? error));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

export function runtimeEntryPoint(runtime: string): string {
  return join(runtime, 'node_modules', PACKAGE_NAME, 'bin/porcelain.js');
}

export async function installRuntime(
  runner: CommandRunner,
  nodeExecutable: string,
  source: string,
  destination: string,
  version: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const result = await runner(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--install-links=true',
      '--prefix',
      destination,
      source,
    ],
    { signal },
  );
  signal?.throwIfAborted();
  if (result.code !== 0) throw new RuntimeInstallError(result.stderr.trim());
  const manifestPath = join(
    destination,
    'node_modules',
    PACKAGE_NAME,
    'package.json',
  );
  const manifest = await readJsonFile(manifestPath, packageManifestSchema);
  const reported =
    manifest.kind === 'value' ? manifest.value.version : undefined;
  if (reported !== version)
    throw new RuntimeVersionMismatchError(reported, version);
  signal?.throwIfAborted();
  const loaded = await runner(
    nodeExecutable,
    ['-e', NATIVE_MODULES_LOAD, manifestPath],
    { signal },
  );
  signal?.throwIfAborted();
  if (loaded.code !== 0)
    throw new RuntimeNativeModulesError(loaded.stderr.trim());
}
