import { Effect } from 'effect';
import { makeGitSession } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  openCheckoutEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export function inspectionCheckouts(
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) {
  return Effect.fn('Git.openInspection')(function* (worktreeId: string) {
    const session = yield* makeGitSession(limits);
    const opened = yield* openCheckoutEffect(worktrees, session, worktreeId);
    return { ...opened, limits };
  });
}

export type OpenInspection = ReturnType<typeof inspectionCheckouts>;
