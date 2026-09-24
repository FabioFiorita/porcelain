import type {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type {
  CheckWorktreeService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { reviewPaths, trackedComparisons } from '@porcelain/reviews/rules';
import type {
  ReadPublishedReviewService,
  RefreshReviewActivityService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RefreshReviewActivityUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly refreshReviewActivity: RefreshReviewActivityService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    checkWorktree: CheckWorktreeService,
    readPublishedReview: ReadPublishedReviewService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    readTextFile: ReadTextFileService,
    readChangeDiffs: ReadChangeDiffsService,
    refreshReviewActivity: RefreshReviewActivityService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readTextFile = readTextFile;
    this.readChangeDiffs = readChangeDiffs;
    this.refreshReviewActivity = refreshReviewActivity;
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
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        const texts = await Promise.allSettled(
          reviewPaths(published.review.layers, changes).map((path) =>
            this.readTextFile.execute({ worktreeId, path }, signal),
          ),
        );
        const diffs = await this.readChangeDiffs.execute(
          { worktreeId, comparisons: trackedComparisons(changes) },
          signal,
        );
        this.refreshReviewActivity.execute({
          review: published.review,
          changes,
          texts,
          diffs,
        });
      },
      { callerSignal: context.signal },
    );
  }
}
