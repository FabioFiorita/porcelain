import type {
  ReadReviewEvidenceInput,
  ReadReviewEvidenceResult,
} from '../models/read-review-evidence.ts';
import type { ReviewText } from '../models/review-evidence.ts';
import type { ReviewDiffReader } from '../ports/review-diff-reader.ts';
import type { ReviewFingerprintReader } from '../ports/review-fingerprint-reader.ts';
import type { ReviewStatusReader } from '../ports/review-status-reader.ts';
import type { ReviewTextReader } from '../ports/review-text-reader.ts';
import { reviewPaths, trackedComparisons } from '../rules/review-evidence.ts';

export class ReadReviewEvidenceService {
  private readonly statusReader: ReviewStatusReader;
  private readonly fingerprintReader: ReviewFingerprintReader;
  private readonly textReader: ReviewTextReader;
  private readonly diffReader: ReviewDiffReader;

  constructor(
    statusReader: ReviewStatusReader,
    fingerprintReader: ReviewFingerprintReader,
    textReader: ReviewTextReader,
    diffReader: ReviewDiffReader,
  ) {
    this.statusReader = statusReader;
    this.fingerprintReader = fingerprintReader;
    this.textReader = textReader;
    this.diffReader = diffReader;
  }

  async execute(
    input: ReadReviewEvidenceInput,
    signal?: AbortSignal,
  ): Promise<ReadReviewEvidenceResult> {
    const { worktreeId } = input;
    const status = await this.statusReader.execute({ worktreeId }, signal);
    const { changes } = await this.fingerprintReader.execute(
      { worktreeId, comparisons: status.changes, paths: undefined },
      signal,
    );
    const found = await Promise.all(
      reviewPaths(input.layers, changes).map((path) =>
        this.textReader.execute({ worktreeId, path }, signal).then(
          (text): ReviewText[] => [text],
          (): ReviewText[] => [],
        ),
      ),
    );
    const diffs = await this.diffReader.execute(
      { worktreeId, comparisons: trackedComparisons(changes) },
      signal,
    );
    return {
      changes,
      texts: new Map(found.flat().map((text) => [text.path, text.text])),
      diffs,
    };
  }
}
