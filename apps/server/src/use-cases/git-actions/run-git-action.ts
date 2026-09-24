import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  GitActionScope,
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { GitActionRun } from '@porcelain/git-actions/models';
import type {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { FileChange, Worktree } from '@porcelain/kernel/models';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type {
  ReadPublishedReviewService,
  ReadReviewEvidenceService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Logger } from '../../ports/logger.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type RunGitActionOptions = { deadlineMs: number };

export class RunGitActionUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly acceptGitAction: AcceptGitActionService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly runGitAction: RunGitActionService;
  private readonly recordGitActionProgress: RecordGitActionProgressService;
  private readonly finishGitAction: FinishGitActionService;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceService;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly interruptGitAction: InterruptGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly logger: Logger;
  private readonly options: RunGitActionOptions;

  constructor(
    checkWorktree: CheckWorktreeService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    acceptGitAction: AcceptGitActionService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    runGitAction: RunGitActionService,
    recordGitActionProgress: RecordGitActionProgressService,
    finishGitAction: FinishGitActionService,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceService,
    recordReviewActivity: RecordReviewActivityService,
    interruptGitAction: InterruptGitActionService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
    logger: Logger,
    options: RunGitActionOptions,
  ) {
    this.checkWorktree = checkWorktree;
    this.expireGitActionReceipts = expireGitActionReceipts;
    this.acceptGitAction = acceptGitAction;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.runGitAction = runGitAction;
    this.recordGitActionProgress = recordGitActionProgress;
    this.finishGitAction = finishGitAction;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.recordReviewActivity = recordReviewActivity;
    this.interruptGitAction = interruptGitAction;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
    this.logger = logger;
    this.options = options;
  }

  async execute(
    input: GitActionScope & RunGitActionRequest,
    context: OperationContext,
  ): Promise<RunGitActionResponse> {
    const { worktreeId } = input;
    const { upstreamOid, ...expected } = input.expected;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const { projectId } = worktree;
    const accepted = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => {
        this.expireGitActionReceipts.execute();
        return this.acceptGitAction.execute({
          projectId,
          worktreeId,
          requestId: input.requestId,
          intent: input.input,
          expected:
            upstreamOid === undefined
              ? expected
              : { ...expected, upstream: { oid: upstreamOid ?? undefined } },
        });
      },
      { callerSignal: context.signal },
    );
    if (accepted.kind === 'accepted') {
      this.events.gitActionChanged(accepted.receipt);
      this.runInBackground(worktree, accepted.run);
    }
    return accepted.receipt;
  }

  private runInBackground(worktree: Worktree, run: GitActionRun): void {
    this.lanes.background(
      this.laneKeys.repository(worktree),
      ({ signal }) => this.settle(worktree, run, signal),
      {
        deadlineMs: this.options.deadlineMs,
        onFailure: (error) =>
          this.lanes.finish(async () => this.abandon(run, error)),
      },
    );
  }

  private async settle(
    worktree: Worktree,
    run: GitActionRun,
    signal: AbortSignal,
  ): Promise<void> {
    const ran = await this.runGitAction.execute(
      {
        run,
        changes: await this.targetChanges(run, signal),
        onProgress: (line) => this.progressed(run, line),
      },
      signal,
    );
    const receipt = this.finishGitAction.execute({
      requestId: run.requestId,
      outcome: ran.outcome,
    });
    this.events.gitActionChanged(receipt);
    if (ran.reviewStale)
      this.lanes.background(
        this.laneKeys.repository(worktree),
        (admission) => this.refreshReview(run.worktreeId, admission.signal),
        {
          onFailure: (error) =>
            this.logger.failure({
              kind: 'review-refresh',
              worktreeId: run.worktreeId,
              error,
            }),
        },
      );
  }

  private async refreshReview(
    worktreeId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const published = this.readPublishedReview.execute({ worktreeId });
    if (published.kind === 'none') return;
    const evidence = await this.readReviewEvidence.execute(
      { worktreeId, layers: published.review.layers },
      signal,
    );
    this.recordReviewActivity.execute({ review: published.review, evidence });
  }

  private async targetChanges(
    run: GitActionRun,
    signal: AbortSignal,
  ): Promise<FileChange[]> {
    if (run.target.kind === 'unchecked') return [];
    const status = await this.readWorktreeStatus.execute(
      { worktreeId: run.worktreeId },
      signal,
    );
    const { changes } = await this.readChangeFingerprints.execute(
      {
        worktreeId: run.worktreeId,
        comparisons: status.changes,
        paths: run.target.paths,
      },
      signal,
    );
    return changes;
  }

  private progressed(run: GitActionRun, line: string): void {
    const recorded = this.recordGitActionProgress.execute({
      requestId: run.requestId,
      line,
    });
    if (recorded.kind === 'recorded')
      this.events.gitActionChanged(recorded.receipt);
  }

  private abandon(run: GitActionRun, error: unknown): void {
    const { requestId } = run;
    this.logger.failure({ kind: 'git-action', requestId, error });
    try {
      this.events.gitActionChanged(
        this.interruptGitAction.execute({ requestId }),
      );
    } catch (interruption) {
      this.logger.failure({
        kind: 'git-action',
        requestId,
        error: interruption,
      });
    }
  }
}
