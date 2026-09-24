import type {
  RemoveReviewedLayerQuery,
  RemoveReviewedLayerResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  RemoveReviewedLayerService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class RemoveReviewedLayerUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly removeReviewedLayer: RemoveReviewedLayerService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    removeReviewedLayer: RemoveReviewedLayerService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.removeReviewedLayer = removeReviewedLayer;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.listReviewedLayers = listReviewedLayers;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & RemoveReviewedLayerQuery,
    context: OperationContext,
  ): Promise<RemoveReviewedLayerResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async ({ signal }) => {
        const { removed } = this.removeReviewedLayer.execute(input);
        return {
          removed,
          ...this.listReviewedLayers.execute({
            worktreeId,
            texts: (
              await this.readTextFiles.execute(
                {
                  worktreeId,
                  paths: this.listReviewedLayerPaths.execute({ worktreeId })
                    .paths,
                },
                signal,
              )
            ).texts,
          }),
        };
      },
      { callerSignal: context.signal },
    );
    const { removed, ...response } = result;
    if (removed)
      this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return response;
  }
}
