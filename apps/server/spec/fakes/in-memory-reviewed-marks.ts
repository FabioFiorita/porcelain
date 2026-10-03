import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { InvalidateReviewedMarksUseCasePort } from '../../src/ports/invalidate-reviewed-marks-use-case-port.ts';

export class InMemoryReviewedMarks implements InvalidateReviewedMarksUseCasePort {
  private readonly marks: Map<string, ReadonlySet<string>>;
  private readonly settled: Promise<void>;

  constructor(
    seed: Readonly<Record<string, readonly string[]>>,
    settled: Promise<void> = Promise.resolve(),
  ) {
    this.marks = new Map(
      Object.entries(seed).map(([worktreeId, paths]) => [
        worktreeId,
        new Set(paths),
      ]),
    );
    this.settled = settled;
  }

  async execute(input: InvalidateReviewedMarksInput): Promise<void> {
    await this.settled;
    const current = [...(this.marks.get(input.worktreeId) ?? [])];
    const invalidated = new Set(input.paths ?? current);
    this.marks.set(
      input.worktreeId,
      new Set(current.filter((path) => !invalidated.has(path))),
    );
  }

  marksOf(worktreeId: string): string[] {
    return [...(this.marks.get(worktreeId) ?? [])];
  }
}
