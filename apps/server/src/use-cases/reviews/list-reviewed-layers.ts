import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
} from '@porcelain/reviews/services';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ListReviewedLayersUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.listReviewedLayers = listReviewedLayers;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListReviewedLayersResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,
      async ({ signal }) => {
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
  }
}
