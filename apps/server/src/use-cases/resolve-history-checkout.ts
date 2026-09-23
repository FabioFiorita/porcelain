import type { HistoryCheckout } from '@porcelain/git/dtos/commit-history';
import { HistoryWorktreeUnavailableError } from '@porcelain/git/errors/history-worktree-unavailable-error';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export async function resolveHistoryCheckout(
  worktrees: ResolveWorktree,
  store: InventoryStore,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<HistoryCheckout> {
  let worktree: Awaited<ReturnType<ResolveWorktree['reachable']>>;
  try {
    worktree = await worktrees.reachable(worktreeId, signal);
  } catch (error) {
    if (error instanceof RepositoryIdentityMismatchError)
      throw new HistoryWorktreeUnavailableError();
    throw error;
  }
  return {
    path: worktree.path,
    commonDirectory: worktree.commonDirectory,
    administrativeDirectory: worktree.administrativeDirectory,
    repositoryIdentity: worktree.repositoryIdentity,
    metadataIdentity: worktree.metadataIdentity,
    scope: `${store.read().environmentId}:${worktree.projectId}:${worktree.id}`,
  };
}
