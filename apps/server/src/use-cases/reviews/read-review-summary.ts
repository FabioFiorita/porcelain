import type {
  ReadReviewSummaryParams,
  ReadReviewSummaryQuery,
  ReadReviewSummaryResponse,
} from '@porcelain/contracts/reviews';
import type { ReadReviewSummaryService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadReviewSummaryUseCase {
  private readonly readReviewSummary: ReadReviewSummaryService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readReviewSummary: ReadReviewSummaryService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readReviewSummary = readReviewSummary;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
    context: OperationContext,
  ): Promise<ReadReviewSummaryResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
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
