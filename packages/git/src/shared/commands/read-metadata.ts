import { Effect } from 'effect';
import { GitFilesystemError } from '../errors/git-filesystem-error.ts';

export function readMetadata<A>(
  read: () => Promise<A>,
): Effect.Effect<A, GitFilesystemError> {
  return Effect.tryPromise({
    try: read,
    catch: (cause) => new GitFilesystemError({ cause }),
  });
}
