import { join } from 'node:path';
import { NotPackagedCliError } from './errors/not-packaged-cli-error.ts';
import { readJsonFile } from './json-file.ts';
import { PACKAGE_NAME } from './persistent-runtime.ts';
import { packageManifestSchema } from './records.ts';

type PackageIdentity = { packageRoot: string; packageVersion: string };

export async function readPackageIdentity(
  packageRoot: string,
): Promise<PackageIdentity> {
  const manifest = await readJsonFile(
    join(packageRoot, 'package.json'),
    packageManifestSchema,
  );
  if (
    manifest.kind !== 'value' ||
    manifest.value.name !== PACKAGE_NAME ||
    manifest.value.version === undefined
  )
    throw new NotPackagedCliError();
  return { packageRoot, packageVersion: manifest.value.version };
}

export async function readPackageVersion(
  packageRoot: string,
): Promise<string | undefined> {
  try {
    return (await readPackageIdentity(packageRoot)).packageVersion;
  } catch (error) {
    if (error instanceof NotPackagedCliError) return undefined;
    throw error;
  }
}
