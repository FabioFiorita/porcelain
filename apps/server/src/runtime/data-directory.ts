import { Effect, FileSystem, Option } from 'effect';
import { DataDirectoryInsecureError } from './errors/data-directory-insecure-error.ts';

export const prepareDataDirectory = Effect.fn('prepareDataDirectory')(
  function* (dataDirectory: string) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 });
    const directory = yield* fs.realPath(dataDirectory);
    const stats = yield* fs.stat(directory);
    const uid = process.getuid?.();
    if (uid !== undefined && Option.getOrUndefined(stats.uid) !== uid)
      return yield* Effect.fail(
        new DataDirectoryInsecureError(
          directory,
          'it belongs to a different user',
        ),
      );
    const mode = stats.mode & 0o777;
    if ((mode & 0o077) !== 0)
      return yield* Effect.fail(
        new DataDirectoryInsecureError(
          directory,
          `its mode is ${mode.toString(8).padStart(3, '0')}, which lets other users reach the owner socket`,
        ),
      );
    return directory;
  },
);
