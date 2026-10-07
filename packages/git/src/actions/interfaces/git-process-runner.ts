import type { Effect } from 'effect';
import type { ChildProcessSpawner } from 'effect/process';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitProcessResult } from '../../shared/commands/run-git.ts';
import type { GitCommandError } from '../../shared/errors/git-command-error.ts';
import type { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
export interface GitProcessRunner {
  readonly limits: GitLimits;
  readonly execute: (
    args: readonly string[],
    input?: string,
    options?: { indexFile?: string },
  ) => Effect.Effect<
    GitProcessResult,
    GitCommandError | GitActionRejectedError,
    ChildProcessSpawner.ChildProcessSpawner
  >;
}
