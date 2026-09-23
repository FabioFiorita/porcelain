import type {
  ReadReviewChangesInput,
  ReadReviewChangesResult,
} from '../models/review-operations.ts';
import type { WorktreeChangeReader } from '../ports/worktree-change-reader.ts';

export class ReadReviewChangesService {
  private readonly worktreeChangeReader: WorktreeChangeReader;

  constructor(worktreeChangeReader: WorktreeChangeReader) {
    this.worktreeChangeReader = worktreeChangeReader;
  }

  async execute(
    input: ReadReviewChangesInput,
    signal?: AbortSignal,
  ): Promise<ReadReviewChangesResult> {
    try {
      return await this.worktreeChangeReader.read(input.worktreeId, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return undefined;
    }
  }
}
