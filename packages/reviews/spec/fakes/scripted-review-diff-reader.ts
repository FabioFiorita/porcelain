import type { ReadReviewDiffsInput } from '../../src/models/read-review-evidence.ts';
import type { ReviewDiff } from '../../src/models/review-evidence.ts';
import type { ReviewDiffReader } from '../../src/ports/review-diff-reader.ts';

export class ScriptedReviewDiffReader implements ReviewDiffReader {
  private readonly diffs: readonly ReviewDiff[];

  constructor(diffs: readonly ReviewDiff[]) {
    this.diffs = diffs;
  }

  async execute(input: ReadReviewDiffsInput): Promise<ReviewDiff[]> {
    return this.diffs.filter((diff) =>
      input.comparisons.some(
        (comparison) =>
          comparison.scope === diff.selection.scope &&
          comparison.newPath === diff.selection.newPath &&
          comparison.oldPath === diff.selection.oldPath,
      ),
    );
  }
}
