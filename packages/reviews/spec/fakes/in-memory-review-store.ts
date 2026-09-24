import type { Review, ReviewSummary } from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

export class InMemoryReviewStore implements ReviewStore {
  private rows: Review[] = [];

  read(input: { worktreeId: string }): Review | undefined {
    const review = this.rows.find((row) => row.worktreeId === input.worktreeId);
    return review && structuredClone(review);
  }

  findSummary(input: { token: string }): ReviewSummary | undefined {
    const review = this.rows.find((row) => row.summaryToken === input.token);
    return (
      review && {
        summaryHtml: review.summaryHtml,
        summaryToken: review.summaryToken,
        summarySecret: review.summarySecret,
      }
    );
  }

  save(input: Review): void {
    this.rows = [
      ...this.rows.filter((row) => row.worktreeId !== input.worktreeId),
      structuredClone(input),
    ];
  }

  setActive(input: {
    worktreeId: string;
    revision: number;
    active: boolean;
  }): void {
    this.rows = this.rows.map((row) =>
      row.worktreeId === input.worktreeId && row.revision === input.revision
        ? { ...row, active: input.active }
        : row,
    );
  }
}
