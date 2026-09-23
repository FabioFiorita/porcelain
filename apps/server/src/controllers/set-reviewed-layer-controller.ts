import type {
  SetReviewedLayerRequest,
  SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  ReadPublishedReviewService,
  ReadReviewFilesService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class SetReviewedLayerController {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewFiles: ReadReviewFilesService;
  private readonly setReviewedLayer: SetReviewedLayerService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    readPublishedReview: ReadPublishedReviewService,
    readReviewFiles: ReadReviewFilesService,
    setReviewedLayer: SetReviewedLayerService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.readPublishedReview = readPublishedReview;
    this.readReviewFiles = readReviewFiles;
    this.setReviewedLayer = setReviewedLayer;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & SetReviewedLayerRequest,
    context: OperationContext,
  ): Promise<SetReviewedLayerResponse> {
    const { worktreeId } = input;
    const result = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        const review = this.readPublishedReview.execute({ worktreeId });
        const files = await this.readReviewFiles.execute(
          { worktreeId, layers: review?.layers ?? [] },
          signal,
        );
        return this.setReviewedLayer.execute({
          worktreeId,
          layerId: input.layerId,
          fingerprint: input.fingerprint,
          review,
          files,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'reviewed');
    return result;
  }
}
