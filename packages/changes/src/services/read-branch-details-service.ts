import type {
  ReadBranchDetailsInput,
  ReadBranchDetailsResult,
} from '../models/read-branch-details.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadBranchDetailsService {
  private readonly changeStatusReader: ChangeStatusReader;

  constructor(changeStatusReader: ChangeStatusReader) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: ReadBranchDetailsInput,
    signal?: AbortSignal,
  ): Promise<ReadBranchDetailsResult> {
    return this.changeStatusReader.readBranchDetails(
      {
        worktreeId: input.worktreeId,
        branchName: input.branch?.name,
        headOid: input.headOid,
      },
      signal,
    );
  }
}
