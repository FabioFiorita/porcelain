import { Context, type Effect } from 'effect';
import type { WorktreeWrite } from '@porcelain/effects/worktree';
import type { WorktreeCleanupPlan } from '@porcelain/kernel/models';
import type { WorktreeCleanupTarget } from '../models/worktree-cleanup.ts';
import type { WorktreeCleanupRefusedError } from '../errors/worktree-cleanup-refused-error.ts';
export interface WorktreeCleaner {
  readonly execute: (
    input: WorktreeCleanupTarget,
  ) => Effect.Effect<
    WorktreeCleanupPlan,
    WorktreeCleanupRefusedError,
    WorktreeWrite
  >;
}
export const WorktreeCleaner = Context.Service<
  '@porcelain/git-actions/WorktreeCleaner',
  WorktreeCleaner
>('@porcelain/git-actions/WorktreeCleaner');
