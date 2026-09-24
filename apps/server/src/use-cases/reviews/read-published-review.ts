import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadPublishedReviewResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type {
  GeneratePublishedReviewService,
  ListReviewEvidenceService,
  ReadPublishedReviewService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadPublishedReviewUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly listReviewEvidence: ListReviewEvidenceService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly generatePublishedReview: GeneratePublishedReviewService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readPublishedReview: ReadPublishedReviewService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    listReviewEvidence: ListReviewEvidenceService,
    readTextFile: ReadTextFileService,
    readChangeDiffs: ReadChangeDiffsService,
    readEnvironment: ReadEnvironmentService,
    generatePublishedReview: GeneratePublishedReviewService,
    recordReviewActivity: RecordReviewActivityService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readPublishedReview = readPublishedReview;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.listReviewEvidence = listReviewEvidence;
    this.readTextFile = readTextFile;
    this.readChangeDiffs = readChangeDiffs;
    this.readEnvironment = readEnvironment;
    this.generatePublishedReview = generatePublishedReview;
    this.recordReviewActivity = recordReviewActivity;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadPublishedReviewResponse> {
    const { worktreeId } = input;
    const lane = this.laneKeys.worktree(worktreeId);
    const read = await this.lanes.run(
      lane,
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        const published = this.readPublishedReview.execute({ worktreeId });
        if (published.kind === 'none') return published;
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        const evidence = this.listReviewEvidence.execute({
          layers: published.review.layers,
          changes,
        });
        const texts = await Promise.allSettled(
          evidence.paths.map((path) =>
            this.readTextFile.execute({ worktreeId, path }, signal),
          ),
        );
        const diffs = await this.readChangeDiffs.execute(
          { worktreeId, comparisons: evidence.comparisons },
          signal,
        );
        const resolved = this.generatePublishedReview.execute({
          environmentId: this.readEnvironment.execute().environmentId,
          review: published.review,
          changes,
          texts,
          diffs,
        });
        return { ...published, resolved };
      },
      { callerSignal: context.signal },
    );
    if (read.kind === 'none') return { review: undefined };
    await this.lanes.run(
      lane,
      'write',
      async () =>
        this.recordReviewActivity.execute({
          review: read.review,
          active: read.resolved.active,
        }),
      { callerSignal: context.signal },
    );
    return { review: read.resolved };
  }
}
