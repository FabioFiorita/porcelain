import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import type { CheckoutSession, GitSession } from '@porcelain/git/inspection';
import type { Worktree } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/projects/ports';

export type KnownWorktrees = Pick<WorktreeAccess, 'known'>;

export type WritableWorktrees = Pick<WorktreeAccess, 'forWriting'>;

export type OpenedCheckout = { worktree: Worktree; checkout: CheckoutSession };

export async function knownWorktree(
  worktrees: KnownWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<Worktree> {
  const check = await worktrees.known(worktreeId, signal);
  if (check.outcome !== 'found') throw new RepositoryIdentityMismatchError();
  return check.worktree;
}

export async function reachableWorktree(
  worktrees: WritableWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<Worktree> {
  const check = await worktrees.forWriting(worktreeId, signal);
  if (check.outcome !== 'found') throw new RepositoryIdentityMismatchError();
  return check.worktree;
}

export async function openCheckout(
  worktrees: WritableWorktrees,
  session: GitSession,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<OpenedCheckout> {
  const worktree = await reachableWorktree(worktrees, worktreeId, signal);
  return {
    worktree,
    checkout: session.checkout(
      worktree.path,
      worktree.metadataIdentity,
      worktree.repositoryIdentity,
    ),
  };
}
