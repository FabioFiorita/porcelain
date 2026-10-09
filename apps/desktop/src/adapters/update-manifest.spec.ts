import { NodeFileSystem } from '@effect/platform-node';
import { expect, it } from '@effect/vitest';
import { Effect, FileSystem } from 'effect';
import { join } from 'node:path';
import { writeUpdateManifest } from './update-manifest.ts';

it.effect(
  'describes the zip that electron-updater downloads, by name, sha512 and size',
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const folder = yield* fs.makeTempDirectoryScoped({
        prefix: 'porcelain-update-manifest-',
      });
      const zip = join(folder, 'Porcelain-0.66.0-arm64-mac.zip');
      yield* fs.writeFileString(zip, 'Porcelain.app\n'.repeat(20_000));
      const manifest = yield* writeUpdateManifest(zip, '0.66.0');
      expect(manifest).toBe(join(folder, 'latest-mac.yml'));
      expect(yield* fs.readFileString(manifest)).toBe(
        [
          'version: "0.66.0"',
          'files:',
          '  - url: "Porcelain-0.66.0-arm64-mac.zip"',
          '    sha512: KxIoR+ZW7YWbu5pl26sc+PrXmu4n9laCl0GGSPQnJSQM7/8nRR4lJM8V4CE9tHR2QUhF6o8XNOjvRRO2RLCA0g==',
          '    size: 280000',
          'path: "Porcelain-0.66.0-arm64-mac.zip"',
          'sha512: KxIoR+ZW7YWbu5pl26sc+PrXmu4n9laCl0GGSPQnJSQM7/8nRR4lJM8V4CE9tHR2QUhF6o8XNOjvRRO2RLCA0g==',
          'releaseDate: "1970-01-01T00:00:00.000Z"',
          '',
        ].join('\n'),
      );
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);
