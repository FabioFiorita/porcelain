import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { type GitReadOptions, gitRead } from '../../shared/commands/run-git.ts';
import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';

export const runInspection = Effect.fn('Git.runInspection')(
  (
    checkout: string,
    args: readonly string[],
    limits: GitLimits,
    options: GitReadOptions = {},
  ) =>
    gitRead(checkout, args, limits, options).pipe(
      Effect.catchTag('GitOutputLimitError', (cause) =>
        Effect.fail(new InspectionLimitError({ cause })),
      ),
    ),
);
