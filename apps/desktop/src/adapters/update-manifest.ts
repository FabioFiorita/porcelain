import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { DateTime, Effect, FileSystem, Stream } from 'effect';

export const writeUpdateManifest = Effect.fn('writeUpdateManifest')(function* (
  zip: string,
  version: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const hash = createHash('sha512');
  yield* fs
    .stream(zip)
    .pipe(Stream.runForEach((chunk) => Effect.sync(() => hash.update(chunk))));
  const size = Number((yield* fs.stat(zip)).size);
  const sha512 = hash.digest('base64');
  const url = JSON.stringify(basename(zip));
  const released = DateTime.formatIso(yield* DateTime.now);
  const manifest = join(dirname(zip), 'latest-mac.yml');
  yield* fs.writeFileString(
    manifest,
    [
      `version: ${JSON.stringify(version)}`,
      'files:',
      `  - url: ${url}`,
      `    sha512: ${sha512}`,
      `    size: ${size}`,
      `path: ${url}`,
      `sha512: ${sha512}`,
      `releaseDate: ${JSON.stringify(released)}`,
      '',
    ].join('\n'),
  );
  return manifest;
});
