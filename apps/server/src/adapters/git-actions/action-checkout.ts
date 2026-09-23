import type { GitActionScope } from '@porcelain/git-actions/models';
import type { GitSession } from '@porcelain/git/inspection';
import {
  openCheckout,
  type OpenedCheckout,
  type WritableWorktrees,
} from '../projects/checkout-session.ts';

export class ActionCheckouts {
  private readonly worktrees: WritableWorktrees;

  constructor(worktrees: WritableWorktrees) {
    this.worktrees = worktrees;
  }

  resolve(
    scope: GitActionScope,
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<OpenedCheckout> {
    return openCheckout(this.worktrees, session, scope.worktreeId, signal);
  }
}
