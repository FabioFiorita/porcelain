import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  Review,
  ReviewActivity,
  ReviewSummary,
  ReviewSummaryKey,
} from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

function activityKey(worktreeId: string, revision: number): string {
  return `${worktreeId}\0${revision}`;
}

export class InMemoryReviewStore implements ReviewStore {
  private readonly rows: Map<string, Review>;
  private readonly activity = new Map<string, boolean>();

  constructor(reviews: readonly Review[] = []) {
    this.rows = new Map(
      reviews.map((review) => [review.worktreeId, structuredClone(review)]),
    );
  }

  read(input: WorktreeKey): Review | undefined {
    const review = this.rows.get(input.worktreeId);
    return review && this.current(review);
  }

  byWorktrees(input: WorktreeKeys): Review[] {
    return input.worktreeIds
      .map((worktreeId) => this.rows.get(worktreeId))
      .filter((review) => review !== undefined)
      .map((review) => this.current(review));
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
    this.activity.delete(activityKey(input.worktreeId, input.revision));
  }

  setActive(input: ReviewActivity): void {
    this.activity.set(
      activityKey(input.worktreeId, input.revision),
      input.active,
    );
  }

  private current(review: Review): Review {
    return {
      ...structuredClone(review),
      active:
        this.activity.get(activityKey(review.worktreeId, review.revision)) ??
        review.active,
    };
  }
}
