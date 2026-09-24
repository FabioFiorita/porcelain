import type { SelectedDiffRequest } from '@porcelain/git-actions/models';
import type { SelectedDiffReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  openCheckout,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitSelectedDiffReader implements SelectedDiffReader {
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
    input: SelectedDiffRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const { checkout } = await openCheckout(
      this.worktrees,
      new RequestGitSession(this.limits),
      input.worktreeId,
      signal,
    );
    return this.git(checkout).readSelectedDiff(
      input.headOid ?? null,
      input.paths,
      signal ?? new AbortController().signal,
    );
  }
}
