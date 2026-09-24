import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { PublishReviewToolResponse } from '@porcelain/contracts/reviews';
import type { ReviewPublication } from '@porcelain/reviews/models';
import type {
  GeneratePublishedReviewService,
  PublishReviewService,
  ReadReviewEvidenceService,
} from '@porcelain/reviews/services';
import type { ConfirmWorktreeService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class PublishReviewUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readReviewEvidence: ReadReviewEvidenceService;
  private readonly publishReview: PublishReviewService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly generatePublishedReview: GeneratePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: WorktreeCheck,
    confirmWorktree: ConfirmWorktreeService,
    readReviewEvidence: ReadReviewEvidenceService,
    publishReview: PublishReviewService,
    readEnvironment: ReadEnvironmentService,
    generatePublishedReview: GeneratePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmWorktree = confirmWorktree;
    this.readReviewEvidence = readReviewEvidence;
    this.publishReview = publishReview;
    this.readEnvironment = readEnvironment;
    this.generatePublishedReview = generatePublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: ReviewPublication,
    context: OperationContext,
  ): Promise<PublishReviewToolResponse> {
    const { worktreeId, review: draft } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const published = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async ({ signal }) => {
        const evidence = await this.readReviewEvidence.execute(
          { worktreeId, layers: draft.layers },
          signal,
        );
        this.confirmWorktree.execute({ worktree });
        const { review, warnings } = this.publishReview.execute({
          worktreeId,
          draft,
          evidence,
        });
        return {
          review: this.generatePublishedReview.execute({
            environmentId: this.readEnvironment.execute().environmentId,
            review,
            evidence,
          }),
          warnings,
        };
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'review' });
    return published;
  }
}
