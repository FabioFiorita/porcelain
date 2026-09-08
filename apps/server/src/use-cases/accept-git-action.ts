import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionScope } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';

export class AcceptGitAction {
  private readonly store: GitActionStore;
  constructor(store: GitActionStore) {
    this.store = store;
  }
  execute(
    scope: GitActionScope,
    action: GitActionIntent['action'],
    requestId: string,
    preparationId: string,
  ) {
    const previous = this.store.receipt(requestId);
    if (previous)
      return this.store.accept({
        ...previous,
        ...scope,
        action,
        preparationId,
      });
    if (this.store.isBlocked(scope.projectId))
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const preparation = this.store.preparation(preparationId);
    if (!preparation || preparation.expiresAt <= Date.now())
      throw new GitActionRejectedError('STALE_PREPARATION');
    if (
      preparation.projectId !== scope.projectId ||
      preparation.worktreeId !== scope.worktreeId ||
      preparation.intent.action !== action
    )
      throw new GitActionRejectedError('REQUEST_MISMATCH');
    return this.store.accept({
      ...scope,
      requestId,
      preparationId,
      action,
      state: 'running',
      refreshRequired: false,
      acceptedAt: Date.now(),
    });
  }
}
