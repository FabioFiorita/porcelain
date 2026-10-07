import { writeGit } from '../../runtime/git-io.ts';
import {
  type GitIoFailure,
  GitActionRejectedError,
  GitTimeoutError,
} from '@porcelain/git/errors';
import { Effect } from 'effect';
import { type WorktreeWrite } from '@porcelain/effects/worktree';
import {
  type GitActionExpectation,
  type GitActionRunnerOutcome,
  type GitActionRunRequest,
} from '@porcelain/git-actions/models';
import { type GitActionRunner } from '@porcelain/git-actions/ports';
import {
  type GitActionExpectation as GitExpectation,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import { RequestGitSession, makeGitSession } from '@porcelain/git/inspection';
import { type Limits } from '../../config/limits.ts';
import {
  openCheckout,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitGitActionRunner implements GitActionRunner {
  private readonly worktrees: ListedWorktrees;
  private readonly git: GitActionWriterFactory;
  private readonly limits: Limits['git'];

  constructor(
    worktrees: ListedWorktrees,
    git: GitActionWriterFactory,
    limits: Limits['git'],
  ) {
    this.worktrees = worktrees;
    this.git = git;
    this.limits = limits;
  }

  run(
    input: GitActionRunRequest,
  ): Effect.Effect<GitActionRunnerOutcome, GitIoFailure, WorktreeWrite> {
    return writeGit(input.run.worktreeId, (signal) =>
      this.runNative(input, signal),
    );
  }

  private async runNative(
    input: GitActionRunRequest,
    signal?: AbortSignal,
  ): Promise<GitActionRunnerOutcome> {
    const { run, onProgress } = input;
    try {
      const { checkout } = await openCheckout(
        this.worktrees,
        new RequestGitSession(Effect.runSync(makeGitSession(this.limits))),
        run.worktreeId,
        signal,
      );
      return {
        kind: 'finished',
        outcome: await this.git(checkout).executeDirect(
          run.requestId,
          run.intent,
          gitExpectation(run.expected),
          signal ?? new AbortController().signal,
          onProgress === undefined
            ? undefined
            : (line) => {
                Effect.runSync(onProgress(line));
              },
        ),
      };
    } catch (error) {
      if (error instanceof GitActionRejectedError)
        return { kind: 'refused', reason: error.reason, detail: error.detail };
      if (error instanceof GitTimeoutError) return { kind: 'timed-out' };
      throw error;
    }
  }
}

function gitExpectation(expected: GitActionExpectation): GitExpectation {
  return {
    headOid: expected.headOid ?? null,
    branch: expected.branch ?? null,
    inProgress: expected.inProgress ?? null,
    mergeHeadOid: expected.mergeHeadOid ?? null,
    ...(expected.upstream === undefined
      ? {}
      : { upstreamOid: expected.upstream.oid ?? null }),
    ...(expected.files === undefined ? {} : { files: expected.files }),
  };
}
