import type {
  ReadCurrentChangesInput,
  ReadCurrentChangesResult,
} from '../models/review-operations.ts';
import type { WorktreeChangeReader } from '../ports/worktree-change-reader.ts';

export class ReadCurrentChangesService {
  private readonly worktreeChangeReader: WorktreeChangeReader;

  constructor(worktreeChangeReader: WorktreeChangeReader) {
    this.worktreeChangeReader = worktreeChangeReader;
  }

  execute(
    input: ReadCurrentChangesInput,
    signal?: AbortSignal,
  ): Promise<ReadCurrentChangesResult> {
    return this.worktreeChangeReader.read(input.worktreeId, signal);
  }
}
