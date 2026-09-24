import type {
  ReadReviewSummaryParams,
  ReadReviewSummaryQuery,
  ReadReviewSummaryResponse,
} from '@porcelain/contracts/reviews';
import type { ReadReviewSummaryService } from '@porcelain/reviews/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadReviewSummaryUseCase {
  private readonly readReviewSummary: ReadReviewSummaryService;
  private readonly lanes: Lanes;

  constructor(readReviewSummary: ReadReviewSummaryService, lanes: Lanes) {
    this.readReviewSummary = readReviewSummary;
    this.lanes = lanes;
  }

  execute(
    input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
    context: OperationContext,
  ): Promise<ReadReviewSummaryResponse> {
    return this.lanes.unqueued(
      async () =>
        this.readReviewSummary.execute({
          token: input.token,
          expires: input.expires,
          signature: input.signature,
        }).html,
      { callerSignal: context.signal },
    );
  }
}
