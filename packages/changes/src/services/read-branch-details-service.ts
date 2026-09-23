import type { BranchDetails } from '../models/change-status.ts';
import type { ReadBranchDetailsInput } from '../models/operation-inputs.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadBranchDetailsService {
  private readonly changeStatusReader: ChangeStatusReader;

  constructor(changeStatusReader: ChangeStatusReader) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: ReadBranchDetailsInput,
    signal?: AbortSignal,
  ): Promise<BranchDetails> {
    return this.changeStatusReader.readBranchDetails(
      input.worktreeId,
      input.branch?.name,
      input.headOid,
      signal,
    );
  }
}
