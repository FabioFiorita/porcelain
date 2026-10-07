import { Effect } from 'effect';
import { promiseCheckoutSession } from '@porcelain/git/inspection';
import type {
  InspectionFactory,
  InspectionReader,
} from '@porcelain/git/inspection';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  openCheckoutEffect,
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
    signal?.throwIfAborted();
    const { worktree, checkout } = await Effect.runPromise(
      openCheckoutEffect(worktrees, sessions(signal), worktreeId),
      { signal },
    );
    return { worktree, git: inspection(promiseCheckoutSession(checkout)) };
  };
}
