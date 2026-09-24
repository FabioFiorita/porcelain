import type {
  SetReviewedLayerRequest,
  SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ReadReviewLayerService,
  ReadReviewTextsService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { ConfirmWorktreeService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class SetReviewedLayerUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readReviewLayer: ReadReviewLayerService;
  private readonly readReviewTexts: ReadReviewTextsService;
  private readonly setReviewedLayer: SetReviewedLayerService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: WorktreeCheck,
    confirmWorktree: ConfirmWorktreeService,
    readReviewLayer: ReadReviewLayerService,
    readReviewTexts: ReadReviewTextsService,
    setReviewedLayer: SetReviewedLayerService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmWorktree = confirmWorktree;
    this.readReviewLayer = readReviewLayer;
    this.readReviewTexts = readReviewTexts;
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
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async ({ signal }) => {
        const { layer, paths } = this.readReviewLayer.execute({
          worktreeId,
          layerId: input.layerId,
        });
        const texts = await this.readReviewTexts.execute(
          { worktreeId, paths },
          signal,
        );
        this.confirmWorktree.execute({ worktree });
        return this.setReviewedLayer.execute({
          worktreeId,
          layer,
          fingerprint: input.fingerprint,
          texts,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return result;
  }
}
