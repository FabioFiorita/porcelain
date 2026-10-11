import { Clock, DateTime, Effect, FileSystem, Path, Schema } from 'effect';
import * as PlatformError from 'effect/PlatformError';
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
const lockOwnerSchema = Schema.Struct({
  pid: Schema.Int,
  token: Schema.String,
  bootId: Schema.optional(Schema.String),
  startTime: Schema.optional(Schema.String),
});
type LockOwner = typeof lockOwnerSchema.Type;
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
        try {
          return Schema.decodeUnknownSync(lockOwnerSchema)(JSON.parse(text));
        } catch {
          return undefined;
        }
      }),
      Effect.catch(() => Effect.succeed(undefined)),
    ),
);

const processIdentity = Effect.fn('DirectoryLock.processIdentity')(function* (
  fs: FileSystem.FileSystem,
  pid: number,
) {
  if (process.platform !== 'linux') return undefined;
  const bootId = (yield* fs.readFileString(
    '/proc/sys/kernel/random/boot_id',
  )).trim();
  const stat = yield* fs.readFileString(`/proc/${pid}/stat`);
  const afterCommand = stat.slice(stat.lastIndexOf(')') + 1);
  const startTime = afterCommand.trim().split(/\s+/)[19];
  if (!bootId || !startTime)
    return yield* Effect.fail(
      PlatformError.systemError({
        _tag: 'BadResource',
        module: 'DirectoryLock',
        method: 'processIdentity',
        pathOrDescriptor: `/proc/${pid}/stat`,
        description: 'Could not identify the lock owner process',
      }),
    );
  return { bootId, startTime };
});

const ownerIsAlive = Effect.fn('DirectoryLock.ownerIsAlive')(function* (
  fs: FileSystem.FileSystem,
  owner: LockOwner | undefined,
) {
  if (owner === undefined || !processIsAlive(owner.pid)) return false;
  if (process.platform !== 'linux') return true;
  if (owner.bootId === undefined || owner.startTime === undefined) return true;
  const identity = yield* processIdentity(fs, owner.pid).pipe(
    Effect.catch(() => Effect.succeed(undefined)),
  );
  return (
    identity !== undefined &&
    owner.bootId === identity.bootId &&
    owner.startTime === identity.startTime
  );
});

export const directoryLockIsHeld = Effect.fn('directoryLockIsHeld')(function* (
  path: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const owner = yield* ownerOf(fs, pathApi, path);
  return yield* ownerIsAlive(fs, owner);
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
          ...(yield* processIdentity(fs, process.pid)),
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
          !(yield* ownerIsAlive(fs, owner))
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
