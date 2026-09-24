import type {
  GitActionExpectation,
  GitActionRunnerOutcome,
  GitActionRunRequest,
} from '@porcelain/git-actions/models';
import type { GitActionRunner } from '@porcelain/git-actions/ports';
import {
  GitActionRejectedError,
  type GitActionExpectation as GitExpectation,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import { GitTimeoutError, RequestGitSession } from '@porcelain/git/inspection';
import {
  openCheckout,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitGitActionRunner implements GitActionRunner {
  private readonly worktrees: ListedWorktrees;
  private readonly git: GitActionWriterFactory;

  constructor(worktrees: ListedWorktrees, git: GitActionWriterFactory) {
    this.worktrees = worktrees;
    this.git = git;
  }

  async run(
    input: GitActionRunRequest,
    signal?: AbortSignal,
  ): Promise<GitActionRunnerOutcome> {
    const { run } = input;
    try {
      const { checkout } = await openCheckout(
        this.worktrees,
        new RequestGitSession(),
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
          input.onProgress,
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
