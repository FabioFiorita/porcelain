import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadPublishedReviewResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ResolvePublishedReviewService,
  ReadPublishedReviewService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadPublishedReviewUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceUseCasePort;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceUseCasePort,
    readEnvironment: ReadEnvironmentService,
    resolvePublishedReview: ResolvePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.readEnvironment = readEnvironment;
    this.resolvePublishedReview = resolvePublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadPublishedReviewResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,
      async ({ signal }) => {
        const published = this.readPublishedReview.execute({ worktreeId });
        if (published.kind === 'none') return { review: undefined };
        const evidence = await this.readReviewEvidence.execute(
          { worktreeId, layers: published.review.layers },
          { signal },
        );
        const resolved = this.resolvePublishedReview.execute({
          environmentId: this.readEnvironment.execute().environmentId,
          review: published.review,
          evidence,
        });
        return { review: resolved };
      },
      { callerSignal: context.signal },
    );
  }
}
