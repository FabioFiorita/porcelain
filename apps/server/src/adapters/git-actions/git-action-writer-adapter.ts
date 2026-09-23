import type {
  GitActionExpectation,
  GitActionOutcome,
  GitActionProgressListener,
  GitActionRun,
} from '@porcelain/git-actions/models';
import type { GitActionWriter } from '@porcelain/git-actions/ports';
import {
  GitActionRejectedError,
  RequestGitSession,
  type GitActionExpectation as GitExpectation,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import type { ActionCheckouts } from './action-checkout.ts';

export class GitActionWriterAdapter implements GitActionWriter {
  private readonly checkouts: ActionCheckouts;
  private readonly git: GitActionWriterFactory;

  constructor(checkouts: ActionCheckouts, git: GitActionWriterFactory) {
    this.checkouts = checkouts;
    this.git = git;
  }

  async run(
    run: GitActionRun,
    onProgress: GitActionProgressListener | undefined,
    signal?: AbortSignal,
  ): Promise<GitActionOutcome> {
    const session = new RequestGitSession();
    try {
      const { checkout } = await this.checkouts.resolve(run, session, signal);
      return await this.git(checkout).executeDirect(
        run.requestId,
        run.intent,
        gitExpectation(run.expected),
        signal ?? new AbortController().signal,
        onProgress,
      );
    } catch (error) {
      if (!(error instanceof GitActionRejectedError)) throw error;
      return {
        state: 'rejected',
        reason: error.reason,
        ...(error.detail === undefined ? {} : { message: error.detail }),
        refreshRequired: false,
      };
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
