import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReconcileReviewedLayersService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedLayersUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFile: ReadTextFileService;
  private readonly reconcileReviewedLayers: ReconcileReviewedLayersService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFile: ReadTextFileService,
    reconcileReviewedLayers: ReconcileReviewedLayersService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFile = readTextFile;
    this.reconcileReviewedLayers = reconcileReviewedLayers;
    this.listReviewedLayers = listReviewedLayers;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListReviewedLayersResponse> {
    const { worktreeId } = input;
    const lane = this.laneKeys.worktree(worktreeId);
    const texts = await this.lanes.run(
      lane,
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        const { paths } = this.listReviewedLayerPaths.execute({ worktreeId });
        return Promise.allSettled(
          paths.map((path) =>
            this.readTextFile.execute({ worktreeId, path }, signal),
          ),
        );
      },
      { callerSignal: context.signal },
    );
    return this.lanes.run(
      lane,
      'write',
      async () => {
        this.reconcileReviewedLayers.execute({ worktreeId, texts });
        return this.listReviewedLayers.execute({ worktreeId });
      },
      { callerSignal: context.signal },
    );
  }
}
