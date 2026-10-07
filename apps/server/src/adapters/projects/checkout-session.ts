import { Effect } from 'effect';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors';
import {
  makeGitSession,
  promiseCheckoutSession,
  type EffectGitSession,
  type CheckoutSession,
} from '@porcelain/git/inspection';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { ListedWorktreeAccessReader } from '@porcelain/projects/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { Limits } from '../../config/limits.ts';

export type ListedWorktrees = ListedWorktreeAccessReader;

type OpenedCheckout = {
  worktree: ListedWorktree;
  checkout: CheckoutSession;
};

export type GitSessions = (signal?: AbortSignal) => EffectGitSession;

export function gitSessionPerSignal(limits: Limits['git']): GitSessions {
  const sessions = new WeakMap<AbortSignal, EffectGitSession>();
  return (signal) => {
    if (signal === undefined) return Effect.runSync(makeGitSession(limits));
    const existing = sessions.get(signal);
    if (existing) return existing;
    const created = Effect.runSync(makeGitSession(limits));
    sessions.set(signal, created);
    return created;
  };
}

export const listedWorktreeEffect = Effect.fn('Git.listedWorktree')(function* (
  worktrees: ListedWorktrees,
  worktreeId: string,
) {
  const check = yield* worktrees.known({ worktreeId });
  if (check.kind === 'missing') return yield* new WorktreeNotFoundError();
  if (check.kind === 'unavailable')
    return yield* new RepositoryIdentityMismatchError();
  return check.worktree;
});

export async function listedWorktree(
  worktrees: ListedWorktrees,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<ListedWorktree> {
  signal?.throwIfAborted();
  try {
    return await Effect.runPromise(
      listedWorktreeEffect(worktrees, worktreeId),
      { signal },
    );
  } catch (failure) {
    signal?.throwIfAborted();
    throw failure;
  }
}

export const openCheckoutEffect = Effect.fn('Git.openCheckout')(function* (
  worktrees: ListedWorktrees,
  session: EffectGitSession,
  worktreeId: string,
) {
  const worktree = yield* listedWorktreeEffect(worktrees, worktreeId);
  return {
    worktree,
    checkout: yield* session.checkout(
      worktree.path,
      worktree.metadataIdentity,
      worktree.repositoryIdentity,
    ),
  };
});

export async function openCheckout(
  worktrees: ListedWorktrees,
  session: EffectGitSession,
  worktreeId: string,
  signal?: AbortSignal,
): Promise<OpenedCheckout> {
  signal?.throwIfAborted();
  try {
    const opened = await Effect.runPromise(
      openCheckoutEffect(worktrees, session, worktreeId),
      { signal },
    );
    return {
      worktree: opened.worktree,
      checkout: promiseCheckoutSession(opened.checkout),
    };
  } catch (failure) {
    signal?.throwIfAborted();
    throw failure;
  }
}
