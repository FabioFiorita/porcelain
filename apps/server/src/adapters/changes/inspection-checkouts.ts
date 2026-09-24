import type {
  InspectionFactory,
  InspectionReader,
} from '@porcelain/git/inspection';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  openCheckout,
  type WritableWorktrees,
} from '../projects/checkout-session.ts';
import type { OperationGitSessions } from './operation-git-sessions.ts';

export type InspectedCheckout = {
  worktree: ListedWorktree;
  git: InspectionReader;
};

export class InspectionCheckouts {
  private readonly worktrees: WritableWorktrees;
  private readonly sessions: OperationGitSessions;
  private readonly inspection: InspectionFactory;

  constructor(
    worktrees: WritableWorktrees,
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
    const { worktree, checkout } = await openCheckout(
      this.worktrees,
      this.sessions.for(signal),
      worktreeId,
      signal,
    );
    return { worktree, git: this.inspection(checkout) };
  }
}
