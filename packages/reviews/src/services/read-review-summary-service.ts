import type { Clock } from '@porcelain/kernel/ports';
import { constantTimeEquals } from '@porcelain/kernel/rules';
import { ReviewSummaryNotFoundError } from '../errors/review-summary-not-found-error.ts';
import type {
  ReadReviewSummaryInput,
  ReadReviewSummaryResult,
} from '../models/read-review-summary.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { SignatureSource } from '../ports/signature-source.ts';
import { summaryExpired, summaryMessage } from '../rules/review-digests.ts';

export class ReadReviewSummaryService {
  private readonly reviews: ReviewStore;
  private readonly clock: Clock;
  private readonly signatureSource: SignatureSource;

  constructor(
    reviews: ReviewStore,
    clock: Clock,
    signatureSource: SignatureSource,
  ) {
    this.reviews = reviews;
    this.clock = clock;
    this.signatureSource = signatureSource;
  }

  execute(input: ReadReviewSummaryInput): ReadReviewSummaryResult {
    const summary = this.reviews.findSummary({ token: input.token });
    if (
      summary === undefined ||
      summaryExpired(input.expires, this.clock.now()) ||
      !constantTimeEquals(
        this.signatureSource.sign({
          secret: summary.summarySecret,
          message: summaryMessage(input.token, input.expires),
        }),
        input.signature,
      )
    )
      throw new ReviewSummaryNotFoundError();
    return { html: summary.summaryHtml };
  }
}
