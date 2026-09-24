import type {
  ReadReviewSummaryParams,
  ReadReviewSummaryQuery,
  ReadReviewSummaryResponse,
} from '@porcelain/contracts/reviews';
import type { ReadReviewSummaryService } from '@porcelain/reviews/services';
import type { Lanes } from '../runtime/lanes.ts';

export class ReadReviewSummaryController {
  private readonly readReviewSummary: ReadReviewSummaryService;
  private readonly lanes: Lanes;

  constructor(readReviewSummary: ReadReviewSummaryService, lanes: Lanes) {
    this.readReviewSummary = readReviewSummary;
    this.lanes = lanes;
  }

  execute(
    input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
  ): ReadReviewSummaryResponse {
    this.lanes.assertOpen();
    return this.readReviewSummary.execute(input);
  }
}
