import { Effect, FileSystem } from 'effect';
import { OwnerSocketModeError } from './errors/owner-socket-mode-error.ts';

export const restrictOwnerSocket = Effect.fn('restrictOwnerSocket')(function* (
  path: string,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.chmod(path, 0o600);
  const mode = (yield* fs.stat(path)).mode & 0o777;
  if (mode !== 0o600)
    return yield* Effect.fail(new OwnerSocketModeError(path, mode));
});
