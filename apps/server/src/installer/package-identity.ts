import { join } from 'node:path';
import { NotPackagedCliError } from './errors/not-packaged-cli-error.ts';
import { readJsonFile } from './json-file.ts';
import { packageName } from './persistent-runtime.ts';
import { packageManifestSchema } from './records.ts';

export type PackageIdentity = { packageRoot: string; packageVersion: string };

export async function readPackageIdentity(
  packageRoot: string,
): Promise<PackageIdentity> {
  const manifest = await readJsonFile(
    join(packageRoot, 'package.json'),
    packageManifestSchema,
  );
  if (
    manifest.kind !== 'value' ||
    manifest.value.name !== packageName ||
    manifest.value.version === undefined
  )
    throw new NotPackagedCliError();
  return { packageRoot, packageVersion: manifest.value.version };
}
