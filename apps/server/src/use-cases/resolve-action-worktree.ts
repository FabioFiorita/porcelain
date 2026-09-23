import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { GitActionScope } from '../models/git-action.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveCheckoutSession } from './resolve-inspection-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export async function resolveActionCheckout(
  worktrees: ResolveWorktree,
  store: InventoryStore,
  session: GitSession,
  scope: GitActionScope,
  signal?: AbortSignal,
) {
  await worktrees.inProject(scope.projectId, scope.worktreeId, signal);
  return resolveCheckoutSession(
    worktrees,
    store,
    session,
    scope.worktreeId,
    signal,
  );
}
