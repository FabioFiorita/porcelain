import type {
  InspectionFactory,
  InspectionReader,
} from '@porcelain/git/inspection';
import type {
  CheckoutWorktree,
  CheckoutWorktreeReader,
} from '../git/checkout-session.ts';
import type { OperationGitSessions } from './operation-git-sessions.ts';

export type InspectedCheckout = {
  worktree: CheckoutWorktree;
  git: InspectionReader;
};

export class InspectionCheckouts {
  private readonly worktrees: CheckoutWorktreeReader;
  private readonly sessions: OperationGitSessions;
  private readonly inspection: InspectionFactory;

  constructor(
    worktrees: CheckoutWorktreeReader,
    sessions: OperationGitSessions,
    inspection: InspectionFactory,
  ) {
    this.worktrees = worktrees;
    this.sessions = sessions;
    this.inspection = inspection;
  }

  async open(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<InspectedCheckout> {
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const checkout = this.sessions
      .for(signal)
      .checkout(
        worktree.path,
        worktree.metadataIdentity,
        worktree.repositoryIdentity,
      );
    return { worktree, git: this.inspection(checkout) };
  }
}
