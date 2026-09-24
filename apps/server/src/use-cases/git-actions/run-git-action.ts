import type {
  GitActionScope,
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { GitActionRun } from '@porcelain/git-actions/models';
import type {
  AcceptGitActionService,
  CheckWorktreeService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { CheckProjectService } from '@porcelain/projects/services';
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

export type RunGitActionContext = OperationContext & {
  answered?: (receipt: RunGitActionResponse) => void;
};

export class RunGitActionUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly acceptGitAction: AcceptGitActionService;
  private readonly runGitAction: RunGitActionService;
  private readonly recordGitActionProgress: RecordGitActionProgressService;
  private readonly finishGitAction: FinishGitActionService;
  private readonly refreshPublishedReview: PublishedReviewRefresh;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly options: RunGitActionOptions;

  constructor(
    checkProject: CheckProjectService,
    checkWorktree: CheckWorktreeService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    acceptGitAction: AcceptGitActionService,
    runGitAction: RunGitActionService,
    recordGitActionProgress: RecordGitActionProgressService,
    finishGitAction: FinishGitActionService,
    refreshPublishedReview: PublishedReviewRefresh,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
    options: RunGitActionOptions,
  ) {
    this.checkProject = checkProject;
    this.checkWorktree = checkWorktree;
    this.expireGitActionReceipts = expireGitActionReceipts;
    this.acceptGitAction = acceptGitAction;
    this.runGitAction = runGitAction;
    this.recordGitActionProgress = recordGitActionProgress;
    this.finishGitAction = finishGitAction;
    this.refreshPublishedReview = refreshPublishedReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
    this.options = options;
  }

  async execute(
    input: GitActionScope & RunGitActionRequest,
    context: RunGitActionContext,
  ): Promise<RunGitActionResponse> {
    const scope = { projectId: input.projectId, worktreeId: input.worktreeId };
    this.checkProject.execute(scope);
    await this.lanes.unqueued(
      (signal) => this.checkWorktree.execute(scope, signal),
      { callerSignal: context.signal },
    );
    this.expireGitActionReceipts.execute();
    const accepted = this.acceptGitAction.execute({
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      requestId: input.requestId,
      intent: input.input,
      expected: input.expected,
    });
    if (accepted.run) {
      this.events.gitActionChanged(accepted.receipt);
      this.runInBackground(accepted.run);
    }
    context.answered?.(accepted.receipt);
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
      .catch(() =>
        this.lanes.finish(() => this.settle(run, AbortSignal.abort())),
      )
      .catch(() => undefined);
  }

  private async settle(run: GitActionRun, signal: AbortSignal): Promise<void> {
    const ran = await this.runGitAction.execute(
      {
        run,
        onProgress: (line) => {
          const updated = this.recordGitActionProgress.execute({
            requestId: run.requestId,
            line,
          });
          if (updated) this.events.gitActionChanged(updated);
        },
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
}
