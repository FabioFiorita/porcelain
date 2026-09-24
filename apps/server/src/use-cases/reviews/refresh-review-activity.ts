import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ReadPublishedReviewService,
  ReadReviewChangesService,
  ReadReviewFilesService,
  ReadReviewPatchesService,
  RecordReviewActivityService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RefreshReviewActivityUseCase {
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewChanges: ReadReviewChangesService;
  private readonly readReviewPatches: ReadReviewPatchesService;
  private readonly readReviewFiles: ReadReviewFilesService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;

  constructor(
    readPublishedReview: ReadPublishedReviewService,
    readReviewChanges: ReadReviewChangesService,
    readReviewPatches: ReadReviewPatchesService,
    readReviewFiles: ReadReviewFilesService,
    resolvePublishedReview: ResolvePublishedReviewService,
    recordReviewActivity: RecordReviewActivityService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
  ) {
    this.readPublishedReview = readPublishedReview;
    this.readReviewChanges = readReviewChanges;
    this.readReviewPatches = readReviewPatches;
    this.readReviewFiles = readReviewFiles;
    this.resolvePublishedReview = resolvePublishedReview;
    this.recordReviewActivity = recordReviewActivity;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
  }

  execute(input: WorktreeParams, context: OperationContext): Promise<void> {
    const { worktreeId } = input;
    return this.lanes.unqueued(
      async (signal) => {
        const review = this.readPublishedReview.execute({ worktreeId });
        if (review === undefined) return;
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
      },
      { callerSignal: context.signal },
    );
  }
}
