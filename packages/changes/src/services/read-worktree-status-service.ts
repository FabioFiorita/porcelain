import type {
  ReadWorktreeStatusInput,
  ReadWorktreeStatusResult,
} from '../models/read-worktree-status.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadWorktreeStatusService {
  private readonly changeStatusReader: ChangeStatusReader;

  constructor(changeStatusReader: ChangeStatusReader) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: ReadWorktreeStatusInput,
    signal?: AbortSignal,
  ): Promise<ReadWorktreeStatusResult> {
    return this.changeStatusReader.readStatus(input, signal);
  }
}
