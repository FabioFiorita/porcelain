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
  CheckGitActionScopeService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { FileChange } from '@porcelain/kernel/models';
import type {
  CheckProjectService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type PublishedReviewRefresh = {
  execute(
    input: { worktreeId: string },
    context: OperationContext,
  ): Promise<unknown>;
};

export type RunGitActionOptions = { deadlineMs: number };

export class RunGitActionUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly checkGitActionScope: CheckGitActionScopeService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly acceptGitAction: AcceptGitActionService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly runGitAction: RunGitActionService;
  private readonly recordGitActionProgress: RecordGitActionProgressService;
  private readonly refreshPublishedReview: PublishedReviewRefresh;
  private readonly finishGitAction: FinishGitActionService;
  private readonly interruptGitAction: InterruptGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly options: RunGitActionOptions;

  constructor(
    checkProject: CheckProjectService,
    checkWorktree: CheckWorktreeService,
    checkGitActionScope: CheckGitActionScopeService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    acceptGitAction: AcceptGitActionService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    runGitAction: RunGitActionService,
    recordGitActionProgress: RecordGitActionProgressService,
    refreshPublishedReview: PublishedReviewRefresh,
    finishGitAction: FinishGitActionService,
    interruptGitAction: InterruptGitActionService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
    options: RunGitActionOptions,
  ) {
    this.checkProject = checkProject;
    this.checkWorktree = checkWorktree;
    this.checkGitActionScope = checkGitActionScope;
    this.expireGitActionReceipts = expireGitActionReceipts;
    this.acceptGitAction = acceptGitAction;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.runGitAction = runGitAction;
    this.recordGitActionProgress = recordGitActionProgress;
    this.refreshPublishedReview = refreshPublishedReview;
    this.finishGitAction = finishGitAction;
    this.interruptGitAction = interruptGitAction;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
    this.options = options;
  }

  async execute(
    input: GitActionScope & RunGitActionRequest,
    context: OperationContext,
  ): Promise<RunGitActionResponse> {
    const { projectId, worktreeId } = input;
    const { upstreamOid, ...expected } = input.expected;
    this.checkProject.execute({ projectId });
    const worktree = await this.lanes.unqueued(
      (signal) => this.checkWorktree.execute({ worktreeId }, signal),
      { callerSignal: context.signal },
    );
    this.checkGitActionScope.execute({ projectId, worktree });
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
      this.runInBackground(accepted.run);
    }
    return accepted.receipt;
  }

  private runInBackground(run: GitActionRun): void {
    void this.lanes
      .run(
        this.laneKeys.project(run.projectId),
        'write',
        ({ signal }) => this.settle(run, signal),
        { deadlineMs: this.options.deadlineMs, untilSettled: true },
      )
      .catch(() => this.lanes.finish(async () => this.abandon(run)));
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
    if (ran.reviewStale)
      await this.refreshPublishedReview
        .execute({ worktreeId: run.worktreeId }, { signal })
        .catch(() => undefined);
    this.events.gitActionChanged(
      this.finishGitAction.execute({
        requestId: run.requestId,
        outcome: ran.outcome,
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

  private abandon(run: GitActionRun): void {
    this.events.gitActionChanged(
      this.interruptGitAction.execute({ requestId: run.requestId }),
    );
  }
}
