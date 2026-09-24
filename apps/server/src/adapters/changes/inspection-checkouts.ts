import {
  RequestGitSession,
  type GitSession,
  type InspectionFactory,
  type InspectionReader,
} from '@porcelain/git/inspection';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { Limits } from '../../config/limits.ts';
import {
  openCheckout,
  type ListedWorktrees,
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
  worktrees: ListedWorktrees,
  inspection: InspectionFactory,
  limits: Limits['git'],
): OpenInspection {
  const sessions = new WeakMap<AbortSignal, GitSession>();
  const sessionFor = (signal?: AbortSignal): GitSession => {
    if (signal === undefined) return new RequestGitSession(limits);
    const existing = sessions.get(signal);
    if (existing) return existing;
    const created = new RequestGitSession(limits);
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
