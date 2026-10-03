import type {
  BranchBases,
  BranchPatches,
  BranchPatchesRequest,
  BranchRangeLookup,
  BranchRangeRequest,
} from '../models/branch-changes.ts';
import type { ListBranchBasesInput } from '../models/list-branch-bases.ts';

export interface BranchRangeReader {
  readBranchRange(
    input: BranchRangeRequest,
    signal?: AbortSignal,
  ): Promise<BranchRangeLookup>;
  readBranchPatches(
    input: BranchPatchesRequest,
    signal?: AbortSignal,
  ): Promise<BranchPatches>;
  listBranchBases(
    input: ListBranchBasesInput,
    signal?: AbortSignal,
  ): Promise<BranchBases>;
}
