import { Effect, Path } from 'effect';
import { NotPackagedCliError } from './errors/not-packaged-cli-error.ts';
import { readJsonFile } from './json-file.ts';
import { PACKAGE_NAME } from './persistent-runtime.ts';
import { packageManifestSchema } from './records.ts';

export const readPackageIdentity = Effect.fn('Installer.readPackageIdentity')(
  function* (packageRoot: string) {
    const pathApi = yield* Path.Path;
    const manifest = yield* readJsonFile(
      pathApi.join(packageRoot, 'package.json'),
      packageManifestSchema,
    );
    if (
      manifest.kind !== 'value' ||
      manifest.value.name !== PACKAGE_NAME ||
      manifest.value.version === undefined
    )
      return yield* Effect.fail(new NotPackagedCliError());
    return { packageRoot, packageVersion: manifest.value.version };
  },
);

export const readPackageVersion = Effect.fn('Installer.readPackageVersion')(
  (packageRoot: string) =>
    readPackageIdentity(packageRoot).pipe(
      Effect.map((identity) => identity.packageVersion),
      Effect.catchTag('NotPackagedCliError', () => Effect.succeed(undefined)),
    ),
);
