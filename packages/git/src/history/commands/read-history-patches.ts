import { Effect } from 'effect';
import {
  readCommitDiffs,
  readRangeDiffs,
  type GitDiffResult,
} from '../../inspection/index.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { GitTimeoutError } from '../../shared/errors/git-timeout-error.ts';
import { InvalidGitDiffError } from '../../shared/errors/invalid-git-diff-error.ts';
import { UnsupportedPathEncodingError } from '../../shared/errors/unsupported-path-encoding-error.ts';

export const readCommitPatches = Effect.fn('Git.readCommitPatches')(
  (
    checkout: string,
    oid: string,
    parent: number,
    paths: readonly (readonly string[])[],
    limits: GitLimits,
  ) =>
    inspectionPatches((signal) =>
      readCommitDiffs(checkout, oid, parent, paths, limits, signal),
    ),
);

export const readRangePatches = Effect.fn('Git.readRangePatches')(
  (
    checkout: string,
    from: string,
    to: string,
    paths: readonly (readonly string[])[],
    limits: GitLimits,
  ) =>
    inspectionPatches((signal) =>
      readRangeDiffs(checkout, from, to, paths, limits, signal),
    ),
);

function inspectionPatches(
  read: (signal: AbortSignal) => Promise<Map<string, GitDiffResult> | null>,
) {
  return Effect.callback<
    Map<string, GitDiffResult> | null,
    Effect.Error<ReturnType<typeof patchFailure>>
  >((resume, signal) => {
    const pending = read(signal);
    void pending.then(
      (sections) => resume(Effect.succeed(sections)),
      (cause: unknown) => resume(patchFailure(cause)),
    );
    return Effect.promise(() =>
      pending.then(
        () => undefined,
        () => undefined,
      ),
    );
  });
}

function patchFailure(cause: unknown) {
  if (
    cause instanceof GitCommandError ||
    cause instanceof GitTimeoutError ||
    cause instanceof InvalidGitDiffError ||
    cause instanceof UnsupportedPathEncodingError
  )
    return Effect.fail(cause);
  return Effect.die(cause);
}
