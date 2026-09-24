import type { SelectedDiffRequest } from '@porcelain/git-actions/models';
import type { SelectedDiffReader } from '@porcelain/git-actions/ports';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import { RequestGitSession } from '@porcelain/git/inspection';
import {
  openCheckout,
  type WritableWorktrees,
} from '../projects/checkout-session.ts';

export class GitSelectedDiffReader implements SelectedDiffReader {
  private readonly worktrees: WritableWorktrees;
  private readonly git: GitActionWriterFactory;

  constructor(worktrees: WritableWorktrees, git: GitActionWriterFactory) {
    this.worktrees = worktrees;
    this.git = git;
  }

  async read(
    input: SelectedDiffRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const { checkout } = await openCheckout(
      this.worktrees,
      new RequestGitSession(),
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
