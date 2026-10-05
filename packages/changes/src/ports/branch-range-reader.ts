import { type GitIoFailure } from '@porcelain/git/errors';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type BranchBases,
  type BranchPatches,
  type BranchPatchesRequest,
  type BranchRangeLookup,
  type BranchRangeRequest,
} from '../models/branch-changes.ts';
import { type ListBranchBasesInput } from '../models/list-branch-bases.ts';

export interface BranchRangeReader {
  readBranchRange(
    input: BranchRangeRequest,
  ): Effect.Effect<BranchRangeLookup, GitIoFailure, WorktreeRead>;
  readBranchPatches(
    input: BranchPatchesRequest,
  ): Effect.Effect<BranchPatches, GitIoFailure, WorktreeRead>;
  listBranchBases(
    input: ListBranchBasesInput,
  ): Effect.Effect<BranchBases, GitIoFailure, WorktreeRead>;
}

export const BranchRangeReader = Context.Service<
  '@porcelain/changes/BranchRangeReader',
  BranchRangeReader
>('@porcelain/changes/BranchRangeReader');
