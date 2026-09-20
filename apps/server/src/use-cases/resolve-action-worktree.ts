import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { GitActionScope } from '../models/git-action.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

/** The action target with the request's guarded state for its checkout. */
export async function resolveActionCheckout(
  worktrees: ResolveWorktree,
  store: InventoryStore,
  session: GitSession,
  scope: GitActionScope,
  signal?: AbortSignal,
) {
  // The scope names both, so both are checked: an action prepared for one
  // project must not execute against another's worktree.
  await worktrees.inProject(scope.projectId, scope.worktreeId, signal);
  return resolveCheckoutSession(
    worktrees,
    store,
    session,
    scope.worktreeId,
    signal,
  );
}
