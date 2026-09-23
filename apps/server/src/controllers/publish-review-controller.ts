import type {
  PublishedReview,
  PublishReviewRequest,
  PublishReviewResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ResolvedReview } from '@porcelain/reviews/models';
import type {
  CheckWorktreeAccessService,
  PublishReviewService,
  ReadReviewChangesService,
  ReadReviewFilesService,
  ReadReviewPatchesService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class PublishReviewController {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly readReviewFiles: ReadReviewFilesService;
  private readonly publishReview: PublishReviewService;
  private readonly readReviewChanges: ReadReviewChangesService;
  private readonly readReviewPatches: ReadReviewPatchesService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    readReviewFiles: ReadReviewFilesService,
    publishReview: PublishReviewService,
    readReviewChanges: ReadReviewChangesService,
    readReviewPatches: ReadReviewPatchesService,
    resolvePublishedReview: ResolvePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.readReviewFiles = readReviewFiles;
    this.publishReview = publishReview;
    this.readReviewChanges = readReviewChanges;
    this.readReviewPatches = readReviewPatches;
    this.resolvePublishedReview = resolvePublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & { review: PublishReviewRequest },
    context: OperationContext,
  ): Promise<PublishReviewResponse> {
    const { worktreeId, review: draft } = input;
    const resolved = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        const pointed = await this.readReviewFiles.execute(
          { worktreeId, layers: draft.layers },
          signal,
        );
        const review = this.publishReview.execute({
          worktreeId,
          draft,
          files: pointed,
        });
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
        return this.resolvePublishedReview.execute({
          review,
          files,
          changes,
          patches,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'review');
    return { review: this.presented(resolved) };
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
