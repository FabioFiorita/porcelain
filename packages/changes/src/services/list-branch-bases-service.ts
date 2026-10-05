import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  ListBranchBasesInput,
  ListBranchBasesResult,
} from '../models/list-branch-bases.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';

export class ListBranchBasesService<E = never> {
  private readonly branchRangeReader: BranchRangeReader<E>;

  constructor(branchRangeReader: BranchRangeReader<E>) {
    this.branchRangeReader = branchRangeReader;
  }

  execute(
    input: ListBranchBasesInput,
  ): Effect.Effect<ListBranchBasesResult, E, WorktreeRead> {
    return this.branchRangeReader.listBranchBases(input);
  }
}
