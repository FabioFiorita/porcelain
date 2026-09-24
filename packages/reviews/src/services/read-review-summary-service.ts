import type { Clock } from '@porcelain/kernel/ports';
import { ReviewSummaryNotFoundError } from '../errors/review-summary-not-found-error.ts';
import type {
  ReadReviewSummaryInput,
  ReadReviewSummaryResult,
} from '../models/review-operations.ts';
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
      throw new ReviewSummaryNotFoundError();
    return summary.summaryHtml;
  }
}
