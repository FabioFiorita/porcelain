import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  ReadPublishedReviewService,
  ReadReviewEvidenceService,
  ReconcileReviewedLayersService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RefreshWorktreeReviewUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly reconcileReviewedLayers: ReconcileReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceService,
    recordReviewActivity: RecordReviewActivityService,
    reconcileReviewedLayers: ReconcileReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.recordReviewActivity = recordReviewActivity;
    this.reconcileReviewedLayers = reconcileReviewedLayers;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(input: WorktreeKey, context: OperationContext): Promise<void> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const refreshed = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async ({ signal }) => {
        const published = this.readPublishedReview.execute({ worktreeId });
        if (published.kind === 'none')
          return { review: false, reviewed: false };
        const evidence = await this.readReviewEvidence.execute(
          { worktreeId, layers: published.review.layers },
          signal,
        );
        const activity = this.recordReviewActivity.execute({
          review: published.review,
          evidence,
        });
        const layers = this.reconcileReviewedLayers.execute({
          worktreeId,
          texts: evidence.texts,
        });
        return { review: activity.changed, reviewed: layers.changed };
      },
      { callerSignal: context.signal },
    );
    if (refreshed.review)
      this.events.worktreeChanged({ worktreeId, change: 'review' });
    if (refreshed.reviewed)
      this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
  }
}
