import type {
  RemoveReviewedLayerQuery,
  RemoveReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  RemoveReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RemoveReviewedLayerUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly removeReviewedLayer: RemoveReviewedLayerService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    removeReviewedLayer: RemoveReviewedLayerService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.removeReviewedLayer = removeReviewedLayer;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & RemoveReviewedLayerQuery,
    context: OperationContext,
  ): Promise<RemoveReviewedLayerResponse> {
    const { worktreeId } = input;
    const result = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.removeReviewedLayer.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'reviewed');
    return result;
  }
}
