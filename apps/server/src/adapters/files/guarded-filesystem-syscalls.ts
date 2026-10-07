import { Effect } from 'effect';
import { GuardedFilesystemError } from '../../runtime/errors/guarded-filesystem-error.ts';
import { constants } from 'node:fs';
import { open, opendir } from 'node:fs/promises';

export function syscall<A>(
  work: () => Promise<A>,
): Effect.Effect<A, GuardedFilesystemError> {
  return Effect.uninterruptible(
    Effect.tryPromise({
      try: work,
      catch: (cause) => new GuardedFilesystemError({ cause }),
    }),
  );
}

export const openGuardedFile = (path: string, flags: number, mode?: number) =>
  Effect.acquireRelease(
    syscall(() =>
      open(path, flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, mode),
    ),
    (handle) => syscall(() => handle.close()).pipe(Effect.orDie),
  );

export const openRawDirectory = (path: string) =>
  Effect.acquireRelease(
    syscall(() => opendir(path, { encoding: 'buffer' })),
    (directory) => syscall(() => directory.close()).pipe(Effect.orDie),
  );
