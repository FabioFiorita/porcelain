import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import {
  RequestGitSession,
  type CheckoutSession,
  type GitSession,
} from '@porcelain/git/inspection';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { Limits } from '../../config/limits.ts';

export type ListedWorktrees = Pick<
  WorktreeAccessReader<ListedWorktree>,
  'known'
>;

type OpenedCheckout = {
  worktree: ListedWorktree;
  checkout: CheckoutSession;
};

export type GitSessions = (signal?: AbortSignal) => GitSession;

export function gitSessionPerSignal(limits: Limits['git']): GitSessions {
  const sessions = new WeakMap<AbortSignal, GitSession>();
  return (signal) => {
    if (signal === undefined) return new RequestGitSession(limits);
    const existing = sessions.get(signal);
    if (existing) return existing;
    const created = new RequestGitSession(limits);
    sessions.set(signal, created);
    return created;
  };
}

export async function listedWorktree(
  worktrees: ListedWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<ListedWorktree> {
  const check = await worktrees.known({ worktreeId }, signal);
  if (check.kind === 'missing') throw new WorktreeNotFoundError();
  if (check.kind === 'unavailable') throw new RepositoryIdentityMismatchError();
  return check.worktree;
}

export async function openCheckout(
  worktrees: ListedWorktrees,
  session: GitSession,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<OpenedCheckout> {
  const worktree = await listedWorktree(worktrees, worktreeId, signal);
  return {
    worktree,
    checkout: session.checkout(
      worktree.path,
      worktree.metadataIdentity,
      worktree.repositoryIdentity,
    ),
  };
}
