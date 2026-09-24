import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';

export class ScriptedReviewedMarksInvalidation {
  readonly invalidated = new Map<string, readonly string[] | undefined>();
  settled: Promise<void> = Promise.resolve();

  execute(input: InvalidateReviewedMarksInput): Promise<void> {
    this.invalidated.set(input.worktreeId, input.paths);
    return this.settled;
  }
}
