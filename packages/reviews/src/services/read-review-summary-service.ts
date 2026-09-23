import type {
  ReadReviewSummaryInput,
  ReadReviewSummaryResult,
} from '../models/review-operations.ts';
import type { Clock } from '../ports/clock.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import {
  summaryExpired,
  summarySignatureMatches,
} from '../rules/review-digests.ts';

export class ReadReviewSummaryService {
  private readonly reviewStore: ReviewStore;
  private readonly clock: Clock;

  constructor(reviewStore: ReviewStore, clock: Clock) {
    this.reviewStore = reviewStore;
    this.clock = clock;
  }

  execute(input: ReadReviewSummaryInput): ReadReviewSummaryResult {
    const summary = this.reviewStore.findSummary(input.token);
    if (
      summary === undefined ||
      summaryExpired(input.expires, this.clock.now()) ||
      !summarySignatureMatches(
        summary.summarySecret,
        input.token,
        input.expires,
        input.signature,
      )
    )
      return undefined;
    return summary.summaryHtml;
  }
}
