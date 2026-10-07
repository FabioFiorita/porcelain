import { Effect } from 'effect';
import { lstat, type Stats } from 'node:fs';
import { GitFilesystemError } from '../../shared/errors/git-filesystem-error.ts';
import { isMissing } from '../../shared/errors/is-missing.ts';

export const readActionFile = Effect.fn('Git.readActionFile')((path: string) =>
  Effect.callback<Stats | null, GitFilesystemError>((resume) => {
    lstat(path, (cause, info) =>
      resume(
        cause === null
          ? Effect.succeed(info)
          : isMissing(cause)
            ? Effect.succeed(null)
            : Effect.fail(new GitFilesystemError({ cause })),
      ),
    );
  }),
);
