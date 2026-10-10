import { Effect, Path, Schema } from 'effect';
import { readJsonFile } from '../installer/json-file.ts';
import { packageManifestSchema } from '../installer/records.ts';
import { CliPackageVersionError } from './errors/cli-package-version-error.ts';

export const readCliVersion = Effect.fn('Cli.readVersion')(function* (
  packageRoot: string,
) {
  const pathApi = yield* Path.Path;
  const manifestPath = pathApi.join(packageRoot, 'package.json');
  const identity = yield* readJsonFile(
    manifestPath,
    Schema.Struct({ name: Schema.String }),
  );
  const versionPath =
    identity.kind === 'value' && identity.value.name === '@porcelain/server'
      ? pathApi.resolve(packageRoot, '../../package.json')
      : manifestPath;
  const manifest = yield* readJsonFile(versionPath, packageManifestSchema);
  if (manifest.kind !== 'value')
    return yield* Effect.fail(
      new CliPackageVersionError({ path: versionPath }),
    );
  return manifest.value.version;
});
