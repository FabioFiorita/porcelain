import type {
  CheckWorktreeService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type {
  ReadPublishedReviewService,
  ReadReviewEvidenceService,
  ReconcileReviewedLayersService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RefreshReviewActivityUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly reconcileReviewedLayers: ReconcileReviewedLayersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    checkWorktree: CheckWorktreeService,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceService,
    recordReviewActivity: RecordReviewActivityService,
    reconcileReviewedLayers: ReconcileReviewedLayersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.recordReviewActivity = recordReviewActivity;
    this.reconcileReviewedLayers = reconcileReviewedLayers;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<void> {
    const { listings } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.listKnownWorktrees.execute(this.listRegisteredProjects.execute()),
      { callerSignal: context.signal },
    );
    const refreshed = await Promise.allSettled(
      listings.flatMap((listing) =>
        listing.worktrees
          .filter((worktree) => worktree.available)
          .map((worktree) => this.refresh(worktree.id, context)),
      ),
    );
    const failed = refreshed.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }

  private async refresh(
    worktreeId: string,
    context: OperationContext,
  ): Promise<void> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async ({ signal }) => {
        const published = this.readPublishedReview.execute({ worktreeId });
        if (published.kind === 'none') return;
        const evidence = await this.readReviewEvidence.execute(
          { worktreeId, layers: published.review.layers },
          signal,
        );
        this.recordReviewActivity.execute({
          review: published.review,
          evidence,
        });
        this.reconcileReviewedLayers.execute({
          worktreeId,
          texts: evidence.texts,
        });
      },
      { callerSignal: context.signal },
    );
  }
}
