import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { reviewedLayerMarks } from '@porcelain/reviews/rules';
import type {
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  ReadPublishedReviewService,
  ReadReviewTextsService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ListReviewedLayersUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readReviewTexts: ReadReviewTextsService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly listReviewedLayers: ListReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
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
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,
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
