import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  PublishedReview,
  ReadPublishedReviewResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ResolvedReview } from '@porcelain/reviews/models';
import type {
  CheckWorktreeAccessService,
  ReadPublishedReviewService,
  ReadReviewChangesService,
  ReadReviewFilesService,
  ReadReviewPatchesService,
  RecordReviewActivityService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadPublishedReviewController {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewChanges: ReadReviewChangesService;
  private readonly readReviewPatches: ReadReviewPatchesService;
  private readonly readReviewFiles: ReadReviewFilesService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    readPublishedReview: ReadPublishedReviewService,
    readReviewChanges: ReadReviewChangesService,
    readReviewPatches: ReadReviewPatchesService,
    readReviewFiles: ReadReviewFilesService,
    resolvePublishedReview: ResolvePublishedReviewService,
    recordReviewActivity: RecordReviewActivityService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.readPublishedReview = readPublishedReview;
    this.readReviewChanges = readReviewChanges;
    this.readReviewPatches = readReviewPatches;
    this.readReviewFiles = readReviewFiles;
    this.resolvePublishedReview = resolvePublishedReview;
    this.recordReviewActivity = recordReviewActivity;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadPublishedReviewResponse> {
    const { worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'read' },
          signal,
        );
        const review = this.readPublishedReview.execute({ worktreeId });
        if (review === undefined) return { review: undefined };
        const changes = await this.readReviewChanges.execute(
          { worktreeId },
          signal,
        );
        const patches = await this.readReviewPatches.execute(
          { changes },
          signal,
        );
        const files = await this.readReviewFiles.execute(
          { worktreeId, layers: review.layers, changes },
          signal,
        );
        const resolved = this.resolvePublishedReview.execute({
          environmentId: this.readEnvironment.execute().environmentId,
          review,
          files,
          changes,
          patches,
        });
        this.recordReviewActivity.execute({ review, active: resolved.active });
        return { review: this.presented(resolved) };
      },
      { callerSignal: context.signal },
    );
  }

  private presented(resolved: ResolvedReview): PublishedReview {
    const { summary, ...review } = resolved;
    const query = new URLSearchParams({
      expires: String(summary.expires),
      signature: summary.signature,
    });
    return {
      ...review,
      summary: {
        url: `/review-summaries/${encodeURIComponent(summary.token)}?${query.toString()}`,
        byteLength: summary.byteLength,
      },
    };
  }
}
