import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import type { CheckoutSession, GitSession } from '@porcelain/git/inspection';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';

export type KnownWorktrees = Pick<
  WorktreeAccessReader<ListedWorktree>,
  'known'
>;

export type WritableWorktrees = Pick<
  WorktreeAccessReader<ListedWorktree>,
  'forWriting'
>;

export type OpenedCheckout = {
  worktree: ListedWorktree;
  checkout: CheckoutSession;
};

export async function knownWorktree(
  worktrees: KnownWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<ListedWorktree> {
  const check = await worktrees.known({ worktreeId }, signal);
  if (check.kind !== 'found') throw new RepositoryIdentityMismatchError();
  return check.worktree;
}

export async function reachableWorktree(
  worktrees: WritableWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<ListedWorktree> {
  const check = await worktrees.forWriting({ worktreeId }, signal);
  if (check.kind !== 'found') throw new RepositoryIdentityMismatchError();
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
