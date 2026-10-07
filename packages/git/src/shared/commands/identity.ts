import { Effect } from 'effect';
import { stat, type BigIntStats } from 'node:fs';
import { GitFilesystemError } from '../errors/git-filesystem-error.ts';
import { UnsupportedFilesystemIdentityError } from '../errors/unsupported-filesystem-identity-error.ts';

export const identity = Effect.fn('Git.identity')(function* (path: string) {
  const info = yield* Effect.callback<BigIntStats, GitFilesystemError>(
    (resume) => {
      stat(path, { bigint: true }, (cause, info) => {
        resume(
          cause
            ? Effect.fail(new GitFilesystemError({ cause }))
            : Effect.succeed(info),
        );
      });
    },
  );
  if (info.birthtimeNs === 0n)
    return yield* new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
});
