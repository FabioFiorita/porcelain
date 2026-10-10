import { Clock, DateTime, Effect, FileSystem, Path } from 'effect';
import { randomUUID } from 'node:crypto';
import type { DirectoryLock } from '../ports/directory-lock.ts';

type DirectoryLockOptions = {
  path: string;
  waitMs: number;
  pollMs: number;
  staleTakeovers: number;
  clock: Clock.Clock;
  held: () => Error;
};
type LockOwner = { pid: number; token: string };
const OWNER_FILE = 'owner.json';
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}

const ownerOf = Effect.fn('DirectoryLock.ownerOf')(
  (fs: FileSystem.FileSystem, pathApi: Path.Path, lock: string) =>
    fs.readFileString(pathApi.join(lock, OWNER_FILE)).pipe(
      Effect.map((text): LockOwner | undefined => {
        let owner: unknown;
        try {
          owner = JSON.parse(text);
        } catch {
          return undefined;
        }
        return typeof owner === 'object' &&
          owner !== null &&
          'pid' in owner &&
          typeof owner.pid === 'number' &&
          'token' in owner &&
          typeof owner.token === 'string'
          ? { pid: owner.pid, token: owner.token }
          : undefined;
      }),
      Effect.catch(() => Effect.succeed(undefined)),
    ),
);

export const directoryLockIsHeld = Effect.fn('directoryLockIsHeld')(function* (
  path: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const owner = yield* ownerOf(fs, pathApi, path);
  return owner !== undefined && processIsAlive(owner.pid);
});

export const acquireDirectoryLock = Effect.fn('acquireDirectoryLock')(
  function* (options: DirectoryLockOptions) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    yield* fs.makeDirectory(pathApi.dirname(options.path), {
      recursive: true,
      mode: 0o700,
    });
    const token = randomUUID();
    const candidate = `${options.path}.candidate-${token}`;
    const release = Effect.gen(function* () {
      const owner = yield* ownerOf(fs, pathApi, options.path);
      if (owner?.token === token)
        yield* fs.remove(options.path, { recursive: true, force: true });
    }).pipe(Effect.orDie);
    const claim = Effect.gen(function* () {
      yield* fs.makeDirectory(candidate, { mode: 0o700 });
      const createdAt = yield* DateTime.now.pipe(
        Effect.provideService(Clock.Clock, options.clock),
      );
      yield* fs.writeFileString(
        pathApi.join(candidate, OWNER_FILE),
        JSON.stringify({
          pid: process.pid,
          createdAt: DateTime.formatIso(createdAt),
          token,
        }),
        { mode: 0o600 },
      );
      let waited = 0;
      let takeovers = 0;
      for (;;) {
        const renamed = yield* fs.rename(candidate, options.path).pipe(
          Effect.as(true),
          Effect.catch((error) =>
            error.reason._tag === 'AlreadyExists' ||
            (error.cause instanceof Error &&
              'code' in error.cause &&
              error.cause.code === 'ENOTEMPTY')
              ? Effect.succeed(false)
              : Effect.fail(error),
          ),
        );
        if (renamed) return { release } satisfies DirectoryLock;
        const owner = yield* ownerOf(fs, pathApi, options.path);
        if (
          takeovers < options.staleTakeovers &&
          (owner === undefined || !processIsAlive(owner.pid))
        ) {
          takeovers += 1;
          yield* fs.remove(options.path, { recursive: true, force: true });
          continue;
        }
        if (waited >= options.waitMs) return yield* Effect.fail(options.held());
        yield* Effect.sleep(options.pollMs);
        waited += options.pollMs;
      }
    }).pipe(
      Effect.ensuring(
        fs
          .remove(candidate, { recursive: true, force: true })
          .pipe(Effect.orDie),
      ),
    );
    return yield* Effect.acquireRelease(claim, (lock) => lock.release);
  },
);
