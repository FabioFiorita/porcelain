import type { GitActionScope } from '@porcelain/git-actions/models';
import type { GitSession } from '@porcelain/git/inspection';
import {
  resolveCheckoutSession,
  type CheckoutWorktree,
  type CheckoutWorktreeReader,
  type EnvironmentReader,
} from '../git/checkout-session.ts';

type ProjectWorktrees<T extends CheckoutWorktree> =
  CheckoutWorktreeReader<T> & {
    inProject(
      projectId: string,
      worktreeId: string,
      signal?: AbortSignal,
    ): Promise<unknown>;
  };

export async function resolveActionCheckout<T extends CheckoutWorktree>(
  worktrees: ProjectWorktrees<T>,
  store: EnvironmentReader,
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
