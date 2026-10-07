import { Effect, FileSystem, Path } from 'effect';
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

export function runtimeEntryPoint(runtime: string, pathApi: Path.Path): string {
  return pathApi.join(
    runtime,
    'node_modules',
    PACKAGE_NAME,
    'bin/porcelain.js',
  );
}

export const installRuntime = Effect.fn('Installer.installRuntime')(function* (
  runner: CommandRunner,
  nodeExecutable: string,
  source: string,
  destination: string,
  version: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  yield* fs.remove(destination, { recursive: true, force: true });
  yield* fs.makeDirectory(destination, { recursive: true, mode: 0o700 });
  const result = yield* runner('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    '--install-links=true',
    '--prefix',
    destination,
    source,
  ]);
  if (result.code !== 0)
    return yield* Effect.fail(
      new RuntimeInstallError({ detail: result.stderr.trim() }),
    );
  const manifestPath = pathApi.join(
    destination,
    'node_modules',
    PACKAGE_NAME,
    'package.json',
  );
  const manifest = yield* readJsonFile(manifestPath, packageManifestSchema);
  const reported =
    manifest.kind === 'value' ? manifest.value.version : undefined;
  if (reported !== version)
    return yield* Effect.fail(
      new RuntimeVersionMismatchError({
        reported: reported,
        expected: version,
      }),
    );
  const loaded = yield* runner(nodeExecutable, [
    '-e',
    NATIVE_MODULES_LOAD,
    manifestPath,
  ]);
  if (loaded.code !== 0)
    return yield* Effect.fail(
      new RuntimeNativeModulesError({ detail: loaded.stderr.trim() }),
    );
});
