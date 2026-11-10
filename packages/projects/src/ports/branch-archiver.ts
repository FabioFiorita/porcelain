import { Context, type Effect } from 'effect';
import type { WorktreeCleanupPlan } from '@porcelain/kernel/models';
import type { BranchArchiveTarget } from '../models/archive-branch.ts';
import type { BranchArchiveRefusedError } from '../errors/branch-archive-refused-error.ts';
export interface BranchArchiver {
  readonly execute: (
    input: BranchArchiveTarget,
  ) => Effect.Effect<WorktreeCleanupPlan, BranchArchiveRefusedError>;
}
export const BranchArchiver = Context.Service<
  '@porcelain/projects/BranchArchiver',
  BranchArchiver
>('@porcelain/projects/BranchArchiver');
