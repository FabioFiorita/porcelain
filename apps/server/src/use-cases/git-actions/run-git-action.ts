import { Cause, Effect } from 'effect';
import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { GitActionRun } from '@porcelain/git-actions/models';
import type {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { FileChange } from '@porcelain/kernel/models';
import type { GitActionNotFoundError } from '@porcelain/git-actions/errors';
import type { WorktreeRead, WorktreeWrite } from '@porcelain/effects/worktree';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Logger } from '../../ports/logger.ts';
import type { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';

type RunGitActionOptions = { deadlineMs: number };

export class RunGitActionUseCase {
  private readonly access: WorktreeAccess;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly acceptGitAction: AcceptGitActionService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly runGitAction: RunGitActionService<GitIoFailure>;
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
    access: WorktreeAccess,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    acceptGitAction: AcceptGitActionService,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    runGitAction: RunGitActionService<GitIoFailure>,
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
    this.access = access;
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

  execute(
    input: WorktreeParams & RunGitActionRequest,
  ): Effect.Effect<
    RunGitActionResponse,
    | WorktreeAccessFailure
    | Effect.Error<ReturnType<AcceptGitActionService['execute']>>
  > {
    return this.access
      .transaction(
        input.worktreeId,
        (worktree) => Effect.succeed(worktree),
        (worktree) =>
          Effect.gen({ self: this }, function* () {
            const { upstreamOid, ...expected } = input.expected;
            yield* this.expireGitActionReceipts.execute({
              worktreeId: input.worktreeId,
            });
            const accepted = yield* this.acceptGitAction.execute({
              projectId: worktree.projectId,
              worktreeId: input.worktreeId,
              requestId: input.requestId,
              intent: input.input,
              expected:
                upstreamOid === undefined
                  ? expected
                  : {
                      ...expected,
                      upstream: { oid: upstreamOid ?? undefined },
                    },
            });
            return { worktree, accepted };
          }),
        ({ worktree, accepted }) =>
          Effect.gen({ self: this }, function* () {
            if (accepted.kind !== 'accepted') return;
            this.events.gitActionChanged(accepted.receipt);
            yield* this.access.background(
              worktree,
              () => this.settle(accepted.run),
              (cause) =>
                this.lanes.finish(this.laneKeys.receipts(worktree), () =>
                  this.abandon(accepted.run, Cause.squash(cause)),
                ),
              this.options,
            );
          }),
        { requireAvailableProject: true },
      )
      .pipe(Effect.map(({ accepted }) => accepted.receipt));
  }

  private settle(
    run: GitActionRun,
  ): Effect.Effect<
    void,
    GitIoFailure | GitActionNotFoundError,
    WorktreeRead | WorktreeWrite
  > {
    return Effect.uninterruptibleMask((restore) =>
      Effect.gen({ self: this }, function* () {
        const ran = yield* restore(
          Effect.gen({ self: this }, function* () {
            const changes = yield* this.targetChanges(run);
            return yield* this.runGitAction.execute({
              run,
              changes,
              onProgress: (line) => this.progressed(run, line),
            });
          }),
        );
        const receipt = yield* this.finishGitAction.execute({
          requestId: run.requestId,
          outcome: ran.outcome,
        });
        this.events.gitActionChanged(receipt);
        if (ran.reviewStale)
          yield* this.lanes.start(
            () =>
              this.refreshWorktreeReview.execute({
                worktreeId: run.worktreeId,
              }),
            (cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.void
                : Effect.sync(() =>
                    this.logger.failure({
                      kind: 'review-refresh',
                      worktreeId: run.worktreeId,
                      error: Cause.squash(cause),
                    }),
                  ),
          );
      }),
    );
  }

  private targetChanges(
    run: GitActionRun,
  ): Effect.Effect<FileChange[], GitIoFailure, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      if (run.target.kind === 'unchecked') return [];
      const status = yield* this.readWorktreeStatus.execute({
        worktreeId: run.worktreeId,
      });
      const { changes } = yield* this.readChangeFingerprints.execute({
        worktreeId: run.worktreeId,
        comparisons: status.changes,
        paths: run.target.paths,
      });
      return changes;
    });
  }

  private progressed(run: GitActionRun, line: string): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const recorded = yield* this.recordGitActionProgress.execute({
        requestId: run.requestId,
        line,
      });
      if (recorded.kind === 'recorded')
        this.events.gitActionChanged(recorded.receipt);
    });
  }

  private abandon(run: GitActionRun, error: unknown): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const { requestId } = run;
      this.logger.failure({ kind: 'git-action', requestId, error });
      const receipt = yield* this.interruptGitAction.execute({ requestId });
      this.events.gitActionChanged(receipt);
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() =>
          this.logger.failure({
            kind: 'git-action',
            requestId: run.requestId,
            error: Cause.squash(cause),
          }),
        ),
      ),
    );
  }
}
