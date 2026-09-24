import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { GitBranchReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import {
  openCheckout,
  type WritableWorktrees,
} from '../projects/checkout-session.ts';

export class GitGitBranchReader implements GitBranchReader {
  private readonly worktrees: WritableWorktrees;
  private readonly git: GitActionWriterFactory;

  constructor(worktrees: WritableWorktrees, git: GitActionWriterFactory) {
    this.worktrees = worktrees;
    this.git = git;
  }

  async read(
    input: GitActionScope,
    signal?: AbortSignal,
  ): Promise<GitBranches> {
    const { checkout } = await openCheckout(
      this.worktrees,
      new RequestGitSession(),
      input.worktreeId,
      signal,
    );
    const listed = await this.git(checkout).listBranches(
      signal ?? new AbortController().signal,
    );
    return {
      current: listed.current ?? undefined,
      branches: listed.branches.map((branch) => ({
        ...branch,
        upstream: branch.upstream ?? undefined,
      })),
    };
  }
}
