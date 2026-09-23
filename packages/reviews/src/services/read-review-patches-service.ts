import type { ReviewPatch } from '../models/review-evidence.ts';
import type {
  ReadReviewPatchesInput,
  ReadReviewPatchesResult,
} from '../models/review-operations.ts';
import type { ChangeDiffReader } from '../ports/change-diff-reader.ts';
import { diffBatches, reviewPatches } from '../rules/review-evidence.ts';

export class ReadReviewPatchesService {
  private readonly changeDiffReader: ChangeDiffReader;

  constructor(changeDiffReader: ChangeDiffReader) {
    this.changeDiffReader = changeDiffReader;
  }

  async execute(
    input: ReadReviewPatchesInput,
    signal?: AbortSignal,
  ): Promise<ReadReviewPatchesResult> {
    const { changes } = input;
    if (changes === undefined) return undefined;
    const patches: ReviewPatch[] = [];
    try {
      for (const batch of diffBatches(changes))
        patches.push(
          ...reviewPatches(
            await this.changeDiffReader.read(
              changes.worktreeId,
              changes.statusToken,
              batch.expectedFiles,
              batch.selections,
              signal,
            ),
          ),
        );
    } catch (error) {
      if (signal?.aborted) throw error;
      return undefined;
    }
    return patches;
  }
}
