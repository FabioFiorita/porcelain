import type {
  ListBranchBasesInput,
  ListBranchBasesResult,
} from '../models/list-branch-bases.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';

export class ListBranchBasesService {
  private readonly branchRangeReader: BranchRangeReader;

  constructor(branchRangeReader: BranchRangeReader) {
    this.branchRangeReader = branchRangeReader;
  }

  execute(
    input: ListBranchBasesInput,
    signal?: AbortSignal,
  ): Promise<ListBranchBasesResult> {
    return this.branchRangeReader.listBranchBases(input, signal);
  }
}
