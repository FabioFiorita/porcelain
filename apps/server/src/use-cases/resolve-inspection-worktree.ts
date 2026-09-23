import type { GitSession } from '@porcelain/git/interfaces/git-session';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

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
