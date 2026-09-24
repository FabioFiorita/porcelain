import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { BranchReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  openCheckout,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitBranchReader implements BranchReader {
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

  async read(
    input: GitActionScope,
    signal?: AbortSignal,
  ): Promise<GitBranches> {
    const { checkout } = await openCheckout(
      this.worktrees,
      new RequestGitSession(this.limits),
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
