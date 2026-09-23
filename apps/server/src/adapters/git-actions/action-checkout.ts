import type { GitActionScope } from '@porcelain/git-actions/models';
import type { GitSession } from '@porcelain/git/inspection';
import {
  resolveCheckoutSession,
  type CheckoutWorktree,
  type CheckoutWorktreeReader,
  type EnvironmentReader,
} from '../git/checkout-session.ts';

export type ActionWorktrees = CheckoutWorktreeReader & {
  inProject(
    projectId: string,
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
};

export class ActionCheckouts {
  private readonly worktrees: ActionWorktrees;
  private readonly environment: EnvironmentReader;

  constructor(worktrees: ActionWorktrees, environment: EnvironmentReader) {
    this.worktrees = worktrees;
    this.environment = environment;
  }

  async resolve(
    scope: GitActionScope,
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<{
    checkout: ReturnType<GitSession['checkout']>;
    worktree: CheckoutWorktree;
  }> {
    await this.worktrees.inProject(scope.projectId, scope.worktreeId, signal);
    const { checkout, worktree } = await resolveCheckoutSession(
      this.worktrees,
      this.environment,
      session,
      scope.worktreeId,
      signal,
    );
    return { checkout, worktree };
  }
}
