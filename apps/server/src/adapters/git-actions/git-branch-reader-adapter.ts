import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { GitBranchReader } from '@porcelain/git-actions/ports';
import {
  RequestGitSession,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import type { ActionCheckouts } from './action-checkout.ts';

export class GitBranchReaderAdapter implements GitBranchReader {
  private readonly checkouts: ActionCheckouts;
  private readonly git: GitActionWriterFactory;

  constructor(checkouts: ActionCheckouts, git: GitActionWriterFactory) {
    this.checkouts = checkouts;
    this.git = git;
  }

  async read(
    scope: GitActionScope,
    signal?: AbortSignal,
  ): Promise<GitBranches | undefined> {
    const { checkout } = await this.checkouts.resolve(
      scope,
      new RequestGitSession(),
      signal,
    );
    const listed = await this.git(checkout).listBranches?.(
      signal ?? new AbortController().signal,
    );
    return (
      listed && {
        current: listed.current ?? undefined,
        branches: listed.branches.map((branch) => ({
          ...branch,
          upstream: branch.upstream ?? undefined,
        })),
      }
    );
  }
}
