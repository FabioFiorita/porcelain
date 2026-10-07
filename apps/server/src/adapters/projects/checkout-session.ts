import { Effect } from 'effect';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors';
import { type EffectGitSession } from '@porcelain/git/inspection';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { ListedWorktreeAccessReader } from '@porcelain/projects/ports';

export type ListedWorktrees = ListedWorktreeAccessReader;

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
