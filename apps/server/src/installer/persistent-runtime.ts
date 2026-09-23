import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { CommandRunner } from './command-runner.ts';
import { RuntimeInstallError } from './errors/runtime-install-error.ts';
import { RuntimeVersionMismatchError } from './errors/runtime-version-mismatch-error.ts';
import { readJsonFile } from './json-file.ts';
import { packageManifestSchema } from './records.ts';

export const packageName = '@fabiofiorita/porcelain';

export function runtimeEntryPoint(runtime: string): string {
  return join(runtime, 'node_modules', packageName, 'bin/porcelain.js');
}

export async function installRuntime(
  runner: CommandRunner,
  source: string,
  destination: string,
  version: string,
): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const result = await runner('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    '--install-links=true',
    '--prefix',
    destination,
    source,
  ]);
  if (result.code !== 0) throw new RuntimeInstallError(result.stderr.trim());
  const manifest = await readJsonFile(
    join(destination, 'node_modules', packageName, 'package.json'),
    packageManifestSchema,
  );
  const reported =
    manifest.kind === 'value' ? manifest.value.version : undefined;
  if (reported !== version)
    throw new RuntimeVersionMismatchError(reported, version);
}
