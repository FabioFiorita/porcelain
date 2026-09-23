import type { ChangeStatusObservation } from '../models/change-status.ts';
import type { WorktreeInput } from '../models/operation-inputs.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadWorktreeStatusService {
  private readonly changeStatusReader: ChangeStatusReader;

  constructor(changeStatusReader: ChangeStatusReader) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: WorktreeInput,
    signal?: AbortSignal,
  ): Promise<ChangeStatusObservation> {
    return this.changeStatusReader.readStatus(input.worktreeId, signal);
  }
}
