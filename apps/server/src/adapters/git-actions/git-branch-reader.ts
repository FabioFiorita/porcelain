import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { BranchReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import {
  openCheckout,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitBranchReader implements BranchReader {
  private readonly worktrees: ListedWorktrees;
  private readonly git: GitActionWriterFactory;

  constructor(worktrees: ListedWorktrees, git: GitActionWriterFactory) {
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
