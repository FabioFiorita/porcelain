import type { SelectedDiffRequest } from '@porcelain/git-actions/models';
import type { SelectedDiffReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import {
  openCheckout,
  type GitSessions,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitSelectedDiffReader implements SelectedDiffReader {
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
    input: SelectedDiffRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const { checkout } = await openCheckout(
      this.worktrees,
      this.sessions(signal),
      input.worktreeId,
      signal,
    );
    return this.git(checkout).readSelectedDiff(
      input.headOid ?? null,
      input.paths,
      signal,
    );
  }
}
