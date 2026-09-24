import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { PublishReviewToolResponse } from '@porcelain/contracts/reviews';
import type {
  CheckWorktreeService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type { ReviewPublication } from '@porcelain/reviews/models';
import type {
  GeneratePublishedReviewService,
  ListReviewEvidenceService,
  PublishReviewService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class PublishReviewUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly listReviewEvidence: ListReviewEvidenceService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly publishReview: PublishReviewService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly generatePublishedReview: GeneratePublishedReviewService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    listReviewEvidence: ListReviewEvidenceService,
    readTextFile: ReadTextFileService,
    readChangeDiffs: ReadChangeDiffsService,
    publishReview: PublishReviewService,
    readEnvironment: ReadEnvironmentService,
    generatePublishedReview: GeneratePublishedReviewService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.listReviewEvidence = listReviewEvidence;
    this.readTextFile = readTextFile;
    this.readChangeDiffs = readChangeDiffs;
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
    const published = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'writing' },
          signal,
        );
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        const evidence = this.listReviewEvidence.execute({
          layers: draft.layers,
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
        const { review, warnings } = this.publishReview.execute({
          worktreeId,
          draft,
          texts,
        });
        return {
          review: this.generatePublishedReview.execute({
            environmentId: this.readEnvironment.execute().environmentId,
            review,
            changes,
            texts,
            diffs,
          }),
          warnings,
        };
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'review');
    return published;
  }
}
