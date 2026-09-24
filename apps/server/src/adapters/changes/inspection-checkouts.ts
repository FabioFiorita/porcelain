import {
  RequestGitSession,
  type GitSession,
  type InspectionFactory,
  type InspectionReader,
} from '@porcelain/git/inspection';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  openCheckout,
  type WritableWorktrees,
} from '../projects/checkout-session.ts';

export type InspectedCheckout = {
  worktree: ListedWorktree;
  git: InspectionReader;
};

export type OpenInspection = (
  worktreeId: string,
  signal?: AbortSignal,
) => Promise<InspectedCheckout>;

export function inspectionCheckouts(
  worktrees: WritableWorktrees,
  inspection: InspectionFactory,
): OpenInspection {
  const sessions = new WeakMap<AbortSignal, GitSession>();
  const sessionFor = (signal?: AbortSignal): GitSession => {
    if (signal === undefined) return new RequestGitSession();
    const existing = sessions.get(signal);
    if (existing) return existing;
    const created = new RequestGitSession();
    sessions.set(signal, created);
    return created;
  };
  return async (worktreeId, signal) => {
    const { worktree, checkout } = await openCheckout(
      worktrees,
      sessionFor(signal),
      worktreeId,
      signal,
    );
    return { worktree, git: inspection(checkout) };
  };
}
