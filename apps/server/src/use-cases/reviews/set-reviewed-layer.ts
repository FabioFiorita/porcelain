import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  SetReviewedLayerRequest,
  SetReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadReviewLayerService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { ConfirmWorktreeService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class SetReviewedLayerUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readReviewLayer: ReadReviewLayerService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly setReviewedLayer: SetReviewedLayerService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    confirmWorktree: ConfirmWorktreeService,
    readReviewLayer: ReadReviewLayerService,
    readTextFiles: ReadTextFilesService,
    setReviewedLayer: SetReviewedLayerService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmWorktree = confirmWorktree;
    this.readReviewLayer = readReviewLayer;
    this.readTextFiles = readTextFiles;
    this.setReviewedLayer = setReviewedLayer;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.listReviewedLayers = listReviewedLayers;
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
        const { texts } = await this.readTextFiles.execute(
          { worktreeId, paths },
          signal,
        );
        this.confirmWorktree.execute({ worktree });
        this.setReviewedLayer.execute({
          worktreeId,
          layer,
          fingerprint: input.fingerprint,
          texts,
        });
        const { paths: marked } = this.listReviewedLayerPaths.execute({
          worktreeId,
        });
        const listed = await this.readTextFiles.execute(
          { worktreeId, paths: marked },
          signal,
        );
        return this.listReviewedLayers.execute({
          worktreeId,
          texts: listed.texts,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return result;
  }
}
