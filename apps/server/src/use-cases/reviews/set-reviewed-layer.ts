import type {
  SetReviewedLayerRequest,
  SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type {
  ReadReviewLayerService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class SetReviewedLayerUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readReviewLayer: ReadReviewLayerService;
  private readonly readTextFile: ReadTextFileService;
  private readonly setReviewedLayer: SetReviewedLayerService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
    readReviewLayer: ReadReviewLayerService,
    readTextFile: ReadTextFileService,
    setReviewedLayer: SetReviewedLayerService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.readReviewLayer = readReviewLayer;
    this.readTextFile = readTextFile;
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
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'writing' },
          signal,
        );
        const { layer, paths } = this.readReviewLayer.execute({
          worktreeId,
          layerId: input.layerId,
        });
        const texts = await Promise.allSettled(
          paths.map((path) =>
            this.readTextFile.execute({ worktreeId, path }, signal),
          ),
        );
        return this.setReviewedLayer.execute({
          worktreeId,
          layer,
          fingerprint: input.fingerprint,
          texts,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'reviewed');
    return result;
  }
}
