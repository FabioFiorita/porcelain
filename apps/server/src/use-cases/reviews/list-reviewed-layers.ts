import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import { reviewedLayerMarks } from '@porcelain/reviews/rules';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadPublishedReviewService,
  ReadReviewTextsService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedLayersUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readReviewTexts: ReadReviewTextsService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readReviewTexts: ReadReviewTextsService,
    readPublishedReview: ReadPublishedReviewService,
    listReviewedLayers: ListReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readReviewTexts = readReviewTexts;
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
      this.laneKeys.reviews(worktree),
      'read',
      async ({ signal }) => {
        const { paths } = this.listReviewedLayerPaths.execute({ worktreeId });
        const texts = await this.readReviewTexts.execute(
          { worktreeId, paths },
          signal,
        );
        const published = this.readPublishedReview.execute({ worktreeId });
        const stored = this.listReviewedLayers.execute({ worktreeId });
        return {
          worktreeId,
          marks: reviewedLayerMarks(
            stored.marks,
            published.kind === 'published' ? published.review.layers : [],
            texts,
          ),
        };
      },
      { callerSignal: context.signal },
    );
  }
}
