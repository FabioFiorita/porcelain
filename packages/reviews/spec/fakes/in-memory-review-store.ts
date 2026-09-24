import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  Review,
  ReviewActivity,
  ReviewSummary,
  ReviewSummaryKey,
} from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

export class InMemoryReviewStore implements ReviewStore {
  private readonly rows: Map<string, Review>;

  constructor(reviews: readonly Review[] = []) {
    this.rows = new Map(
      reviews.map((review) => [review.worktreeId, structuredClone(review)]),
    );
  }

  read(input: WorktreeKey): Review | undefined {
    return structuredClone(this.rows.get(input.worktreeId));
  }

  byWorktrees(input: WorktreeKeys): Review[] {
    return input.worktreeIds
      .map((worktreeId) => this.rows.get(worktreeId))
      .filter((review) => review !== undefined)
      .map((review) => structuredClone(review));
  }

  findSummary(input: ReviewSummaryKey): ReviewSummary | undefined {
    return [...this.rows.values()]
      .filter((review) => review.summaryToken === input.token)
      .map((review) => ({
        summaryHtml: review.summaryHtml,
        summaryToken: review.summaryToken,
        summarySecret: review.summarySecret,
      }))
      .at(0);
  }

  save(input: Review): void {
    this.rows.set(input.worktreeId, structuredClone(input));
  }

  setActive(input: ReviewActivity): void {
    [this.rows.get(input.worktreeId)]
      .filter((review) => review !== undefined)
      .filter((review) => review.revision === input.revision)
      .forEach((review) =>
        this.rows.set(input.worktreeId, { ...review, active: input.active }),
      );
  }
}
