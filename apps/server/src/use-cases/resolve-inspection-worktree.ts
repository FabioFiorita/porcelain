import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

/**
 * A worktree ready to be inspected: found in Git's list, its checkout
 * reachable, and its identity the one the id was derived from.
 *
 * This is asynchronous because Git is the source of truth now. It usually
 * costs one `stat` and two small file reads — no SQLite, and no Git process
 * unless the id is one the directory has not seen.
 */
async function resolveInspectionWorktree(
  worktrees: ResolveWorktree,
  store: InventoryStore,
  worktreeId: string,
  signal?: AbortSignal,
) {
  const worktree = await worktrees.reachable(worktreeId, signal);
  return {
    environmentId: store.read().environmentId,
    worktree,
    metadataIdentity: worktree.metadataIdentity,
    repositoryIdentity: worktree.repositoryIdentity,
  };
}

/** The request's guarded state for one worktree's checkout. */
export async function resolveCheckoutSession(
  worktrees: ResolveWorktree,
  store: InventoryStore,
  session: GitSession,
  worktreeId: string,
  signal?: AbortSignal,
) {
  const resolved = await resolveInspectionWorktree(
    worktrees,
    store,
    worktreeId,
    signal,
  );
  return {
    ...resolved,
    checkout: session.checkout(
      resolved.worktree.path,
      resolved.metadataIdentity,
      resolved.repositoryIdentity,
    ),
  };
}
