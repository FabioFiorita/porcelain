import type {
  ReadReviewSummaryParams,
  ReadReviewSummaryQuery,
  ReadReviewSummaryResponse,
} from '@porcelain/contracts/reviews';
import type { ReadReviewSummaryService } from '@porcelain/reviews/services';
import type { Lanes } from '../../runtime/lanes.ts';
import { Effect } from 'effect';
import type { ReviewSummaryNotFoundError } from '@porcelain/reviews/errors';

export class ReadReviewSummaryUseCase {
  private readonly readReviewSummary: ReadReviewSummaryService;
  private readonly lanes: Lanes;

  constructor(readReviewSummary: ReadReviewSummaryService, lanes: Lanes) {
    this.readReviewSummary = readReviewSummary;
    this.lanes = lanes;
  }

  execute(
    input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
  ): Effect.Effect<ReadReviewSummaryResponse, ReviewSummaryNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      this.lanes.assertOpen();
      return (yield* this.readReviewSummary.execute({
        token: input.token,
        expires: input.expires,
        signature: input.signature,
      })).html;
    });
  }
}
