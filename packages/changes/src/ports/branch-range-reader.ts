import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  BranchBases,
  BranchPatches,
  BranchPatchesRequest,
  BranchRangeLookup,
  BranchRangeRequest,
} from '../models/branch-changes.ts';
import type { ListBranchBasesInput } from '../models/list-branch-bases.ts';

export interface BranchRangeReader<E = never> {
  readBranchRange(
    input: BranchRangeRequest,
  ): Effect.Effect<BranchRangeLookup, E, WorktreeRead>;
  readBranchPatches(
    input: BranchPatchesRequest,
  ): Effect.Effect<BranchPatches, E, WorktreeRead>;
  listBranchBases(
    input: ListBranchBasesInput,
  ): Effect.Effect<BranchBases, E, WorktreeRead>;
}
