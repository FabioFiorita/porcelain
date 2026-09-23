import type {
  ReadReviewFilesInput,
  ReadReviewFilesResult,
} from '../models/review-operations.ts';
import type { WorktreeTextReader } from '../ports/worktree-text-reader.ts';
import { reviewPaths } from '../rules/review-evidence.ts';

export class ReadReviewFilesService {
  private readonly worktreeTextReader: WorktreeTextReader;

  constructor(worktreeTextReader: WorktreeTextReader) {
    this.worktreeTextReader = worktreeTextReader;
  }

  async execute(
    input: ReadReviewFilesInput,
    signal?: AbortSignal,
  ): Promise<ReadReviewFilesResult> {
    const files = new Map<string, string>();
    await Promise.all(
      reviewPaths(input.layers, input.changes).map(async (path) => {
        const text = await this.readable(input.worktreeId, path, signal);
        if (text !== undefined) files.set(path, text);
      }),
    );
    return files;
  }

  private async readable(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    try {
      return await this.worktreeTextReader.read(worktreeId, path, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return undefined;
    }
  }
}
