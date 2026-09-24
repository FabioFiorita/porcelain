import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { BranchReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import {
  openCheckout,
  type GitSessions,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitBranchReader implements BranchReader {
  private readonly worktrees: ListedWorktrees;
  private readonly git: GitActionWriterFactory;
  private readonly sessions: GitSessions;

  constructor(
    worktrees: ListedWorktrees,
    git: GitActionWriterFactory,
    sessions: GitSessions,
  ) {
    this.worktrees = worktrees;
    this.git = git;
    this.sessions = sessions;
  }

  async read(
    input: GitActionScope,
    signal?: AbortSignal,
  ): Promise<GitBranches> {
    const { checkout } = await openCheckout(
      this.worktrees,
      this.sessions(signal),
      input.worktreeId,
      signal,
    );
    const listed = await this.git(checkout).listBranches(signal);
    return {
      current: listed.current ?? undefined,
      branches: listed.branches.map((branch) => ({
        ...branch,
        upstream: branch.upstream ?? undefined,
      })),
    };
  }
}
