import type {
  InspectionFactory,
  InspectionReader,
} from '@porcelain/git/inspection';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  openCheckout,
  type GitSessions,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

type InspectedCheckout = {
  worktree: ListedWorktree;
  git: InspectionReader;
};

export type OpenInspection = (
  worktreeId: string,
  signal?: AbortSignal,
) => Promise<InspectedCheckout>;

export function inspectionCheckouts(
  worktrees: ListedWorktrees,
  inspection: InspectionFactory,
  sessions: GitSessions,
): OpenInspection {
  return async (worktreeId, signal) => {
    const { worktree, checkout } = await openCheckout(
      worktrees,
      sessions(signal),
      worktreeId,
      signal,
    );
    return { worktree, git: inspection(checkout) };
  };
}
