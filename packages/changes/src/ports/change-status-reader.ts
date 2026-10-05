import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  BranchDetails,
  BranchDetailsRequest,
  ChangeStatusObservation,
} from '../models/change-status.ts';
import type { ReadWorktreeStatusInput } from '../models/read-worktree-status.ts';

export interface ChangeStatusReader<E = never> {
  readStatus(
    input: ReadWorktreeStatusInput,
  ): Effect.Effect<ChangeStatusObservation, E, WorktreeRead>;
  readBranchDetails(
    input: BranchDetailsRequest,
  ): Effect.Effect<BranchDetails, E, WorktreeRead>;
}
