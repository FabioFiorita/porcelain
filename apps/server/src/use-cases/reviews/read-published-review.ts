import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadPublishedReviewResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type {
  GeneratePublishedReviewService,
  ReadPublishedReviewService,
  ReadReviewEvidenceService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadPublishedReviewUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly generatePublishedReview: GeneratePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceService,
    readEnvironment: ReadEnvironmentService,
    generatePublishedReview: GeneratePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.readEnvironment = readEnvironment;
    this.generatePublishedReview = generatePublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadPublishedReviewResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const published = this.readPublishedReview.execute({ worktreeId });
        if (published.kind === 'none') return { review: undefined };
        const evidence = await this.readReviewEvidence.execute(
          { worktreeId, layers: published.review.layers },
          signal,
        );
        const resolved = this.generatePublishedReview.execute({
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
