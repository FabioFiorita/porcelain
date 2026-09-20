import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { GitActionScope } from '../models/git-action.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import {
  resolveCheckoutSession,
  resolveInspectionWorktree,
} from './resolve-inspection-worktree.ts';

function resolveActionWorktree(store: InventoryStore, scope: GitActionScope) {
  const project = store
    .read()
    .projects.find((entry) => entry.id === scope.projectId);
  if (!project?.worktrees.some((entry) => entry.id === scope.worktreeId))
    throw new WorktreeNotFoundError();
  return resolveInspectionWorktree(store, scope.worktreeId);
}

/** The action target with the request's guarded state for its checkout. */
export function resolveActionCheckout(
  store: InventoryStore,
  session: GitSession,
  scope: GitActionScope,
) {
  resolveActionWorktree(store, scope);
  return resolveCheckoutSession(store, session, scope.worktreeId);
}
