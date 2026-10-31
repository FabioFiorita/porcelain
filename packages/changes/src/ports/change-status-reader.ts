import type { WorktreeSummary } from '../models/worktree-summary.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type BranchDetails,
  type BranchDetailsRequest,
  type ChangeStatusObservation,
} from '../models/change-status.ts';
import { type ReadWorktreeStatusInput } from '../models/read-worktree-status.ts';

export interface ChangeStatusReader {
  readSummary(
    input: ReadWorktreeStatusInput,
  ): Effect.Effect<WorktreeSummary, GitIoFailure, WorktreeRead>;
  readStatus(
    input: ReadWorktreeStatusInput,
  ): Effect.Effect<ChangeStatusObservation, GitIoFailure, WorktreeRead>;
  readBranchDetails(
    input: BranchDetailsRequest,
  ): Effect.Effect<BranchDetails, GitIoFailure, WorktreeRead>;
}

export const ChangeStatusReader = Context.Service<
  '@porcelain/changes/ChangeStatusReader',
  ChangeStatusReader
>('@porcelain/changes/ChangeStatusReader');
