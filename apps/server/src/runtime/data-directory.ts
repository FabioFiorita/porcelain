import { Effect, FileSystem, Option, Path, type Clock } from 'effect';
import type { Limits } from '../config/limits.ts';
import { acquireDirectoryLock } from './directory-lock.ts';
import { DataDirectoryInsecureError } from './errors/data-directory-insecure-error.ts';

export const canonicalDataDirectory = Effect.fn('canonicalDataDirectory')(
  function* (dataDirectory: string) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 });
    return yield* fs.realPath(dataDirectory);
  },
);

export const prepareDataDirectory = Effect.fn('prepareDataDirectory')(
  function* (dataDirectory: string) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* canonicalDataDirectory(dataDirectory);
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

export const acquireDataDirectoryLock = Effect.fn('acquireDataDirectoryLock')(
  function* (
    directory: string,
    limits: Limits['locks'],
    clock: Clock.Clock,
    held: () => Error,
  ) {
    const path = yield* Path.Path;
    return yield* acquireDirectoryLock({
      path: path.join(directory, 'server.lock'),
      waitMs: limits.startupWaitMs,
      pollMs: limits.pollMs,
      staleTakeovers: limits.staleTakeovers,
      clock,
      held,
    });
  },
);
