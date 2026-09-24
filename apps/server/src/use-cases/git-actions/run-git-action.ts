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
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Logger } from '../../ports/logger.ts';
import type { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export type RunGitActionOptions = { deadlineMs: number };

export class RunGitActionUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly acceptGitAction: AcceptGitActionService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly runGitAction: RunGitActionService;
  private readonly recordGitActionProgress: RecordGitActionProgressService;
  private readonly finishGitAction: FinishGitActionService;
  private readonly refreshWorktreeReview: RefreshWorktreeReviewUseCasePort;
  private readonly interruptGitAction: InterruptGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly logger: Logger;
  private readonly options: RunGitActionOptions;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    acceptGitAction: AcceptGitActionService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    runGitAction: RunGitActionService,
    recordGitActionProgress: RecordGitActionProgressService,
    finishGitAction: FinishGitActionService,
    refreshWorktreeReview: RefreshWorktreeReviewUseCasePort,
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
    this.refreshWorktreeReview = refreshWorktreeReview;
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
      { worktreeId, requireAvailableProject: true },
      context,
    );
    const { projectId } = worktree;
    const accepted = await this.lanes.run(
      this.laneKeys.receipts(worktree),
      'write',
      async () => {
        this.expireGitActionReceipts.execute({ worktreeId });
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
      this.laneKeys.receipts(worktree),
      ({ signal }) => this.settle(run, signal),
      {
        deadlineMs: this.options.deadlineMs,
        onFailure: (error) =>
          this.lanes.finish(async () => this.abandon(run, error), {
            lane: this.laneKeys.receipts(worktree),
          }),
      },
    );
  }

  private async settle(run: GitActionRun, signal: AbortSignal): Promise<void> {
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
      this.refreshWorktreeReview
        .execute({ worktreeId: run.worktreeId }, {})
        .catch((error: unknown) =>
          this.logger.failure({
            kind: 'review-refresh',
            worktreeId: run.worktreeId,
            error,
          }),
        );
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
