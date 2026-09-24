import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import { layerStaleness, reviewFiles } from '@porcelain/reviews/rules';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadPublishedReviewService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedLayersUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFile: ReadTextFileService,
    readPublishedReview: ReadPublishedReviewService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFile = readTextFile;
    this.readPublishedReview = readPublishedReview;
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
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const { paths } = this.listReviewedLayerPaths.execute({ worktreeId });
        const texts = await Promise.allSettled(
          paths.map((path) =>
            this.readTextFile.execute({ worktreeId, path }, signal),
          ),
        );
        const published = this.readPublishedReview.execute({ worktreeId });
        const stored = this.listReviewedLayers.execute({ worktreeId });
        const { stale } = layerStaleness(
          stored.marks.map((mark) => ({ ...mark, stale: false })),
          published.kind === 'published' ? published.review.layers : [],
          reviewFiles(texts),
        );
        return {
          worktreeId,
          marks: stored.marks.map((mark) => ({
            ...mark,
            stale: stale.includes(mark.layerId),
          })),
        };
      },
      { callerSignal: context.signal },
    );
  }
}
