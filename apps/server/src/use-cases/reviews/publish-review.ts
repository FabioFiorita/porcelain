import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  PublishReviewRequest,
  PublishReviewToolResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ResolvePublishedReviewService,
  PublishReviewService,
} from '@porcelain/reviews/services';
import type { ConfirmWorktreeService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class PublishReviewUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readReviewEvidence: ReadReviewEvidenceUseCasePort;
  private readonly publishReview: PublishReviewService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    confirmWorktree: ConfirmWorktreeService,
    readReviewEvidence: ReadReviewEvidenceUseCasePort,
    publishReview: PublishReviewService,
    readEnvironment: ReadEnvironmentService,
    resolvePublishedReview: ResolvePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmWorktree = confirmWorktree;
    this.readReviewEvidence = readReviewEvidence;
    this.publishReview = publishReview;
    this.readEnvironment = readEnvironment;
    this.resolvePublishedReview = resolvePublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & PublishReviewRequest,
    context: OperationContext,
  ): Promise<PublishReviewToolResponse> {
    const { worktreeId, ...draft } = input;
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
          { signal },
        );
        this.confirmWorktree.execute({ worktree });
        const { review, warnings } = this.publishReview.execute({
          worktreeId,
          draft,
          evidence,
        });
        return {
          review: this.resolvePublishedReview.execute({
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
