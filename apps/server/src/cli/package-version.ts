import { Effect, Path, Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import { readJsonFile } from '../installer/json-file.ts';
import { packageManifestSchema } from '../installer/records.ts';
import { CliPackageVersionError } from './errors/cli-package-version-error.ts';

export const cliPackageRoot = Effect.fn('Cli.packageRoot')(function* (
  moduleUrl: string = import.meta.url,
) {
  const pathApi = yield* Path.Path;
  const serverRoot = pathApi.resolve(
    pathApi.dirname(fileURLToPath(moduleUrl)),
    '../..',
  );
  const identity = yield* readJsonFile(
    pathApi.join(serverRoot, 'package.json'),
    Schema.Struct({ name: Schema.String }),
  );
  return identity.kind === 'value' &&
    identity.value.name === '@porcelain/server'
    ? serverRoot
    : pathApi.dirname(serverRoot);
});

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
