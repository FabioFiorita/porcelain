import { RunGitActionUseCaseOptions } from '../../ports/run-git-action-use-case-options.ts';
import { Cause, Effect, Context, Layer } from 'effect';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { type GitActionRun } from '@porcelain/git-actions/models';
import {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { type FileChange } from '@porcelain/kernel/models';
import { type GitActionNotFoundError } from '@porcelain/git-actions/errors';
import {
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { Logger } from '../../ports/logger.ts';
import { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';

export class RunGitActionUseCase extends Context.Service<
  RunGitActionUseCase,
  {
    readonly execute: (
      input: WorktreeParams & RunGitActionRequest,
    ) => Effect.Effect<
      RunGitActionResponse,
      | WorktreeAccessFailure
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof AcceptGitActionService>['execute']
          >
        >
    >;
  }
>()('@porcelain/server/RunGitActionUseCase') {
  static readonly layer = Layer.effect(
    RunGitActionUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const expireGitActionReceiptsCapability =
        yield* ExpireGitActionReceiptsService;
      const acceptGitActionCapability = yield* AcceptGitActionService;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const runGitActionCapability = yield* RunGitActionService;
      const recordGitActionProgressCapability =
        yield* RecordGitActionProgressService;
      const finishGitActionCapability = yield* FinishGitActionService;
      const refreshWorktreeReviewCapability =
        yield* RefreshWorktreeReviewUseCasePort;
      const interruptGitActionCapability = yield* InterruptGitActionService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;
      const loggerCapability = yield* Logger;
      const optionsCapability = yield* RunGitActionUseCaseOptions;
      const operationSettle = Effect.fn('RunGitActionUseCase.settle')(
        function* (
          run: GitActionRun,
        ): Effect.fn.Return<
          void,
          GitIoFailure | GitActionNotFoundError,
          WorktreeRead | WorktreeWrite
        > {
          return yield* Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              const ran = yield* restore(
                Effect.gen(function* () {
                  const changes = yield* operationTargetChanges(run);
                  return yield* runGitActionCapability.execute({
                    run,
                    changes,
                    onProgress: (line) => operationProgressed(run, line),
                  });
                }),
              );
              const receipt = yield* finishGitActionCapability.execute({
                requestId: run.requestId,
                outcome: ran.outcome,
              });
              yield* eventsCapability.gitActionChanged(receipt);
              if (ran.reviewStale)
                yield* lanesCapability.start(
                  () =>
                    refreshWorktreeReviewCapability.execute({
                      worktreeId: run.worktreeId,
                    }),
                  (cause) =>
                    Cause.hasInterruptsOnly(cause)
                      ? Effect.void
                      : Effect.sync(() =>
                          loggerCapability.failure({
                            kind: 'review-refresh',
                            worktreeId: run.worktreeId,
                            error: Cause.squash(cause),
                          }),
                        ),
                );
            }),
          );
        },
      );
      const operationTargetChanges = Effect.fn(
        'RunGitActionUseCase.targetChanges',
      )(function* (
        run: GitActionRun,
      ): Effect.fn.Return<FileChange[], GitIoFailure, WorktreeRead> {
        if (run.target.kind === 'unchecked') return [];
        const status = yield* readWorktreeStatusCapability.execute({
          worktreeId: run.worktreeId,
        });
        const { changes } = yield* readChangeFingerprintsCapability.execute({
          worktreeId: run.worktreeId,
          comparisons: status.changes,
          paths: run.target.paths,
        });
        return changes;
      });
      const operationProgressed = Effect.fn('RunGitActionUseCase.progressed')(
        function* (run: GitActionRun, line: string): Effect.fn.Return<void> {
          const recorded = yield* recordGitActionProgressCapability.execute({
            requestId: run.requestId,
            line,
          });
          if (recorded.kind === 'recorded')
            yield* eventsCapability.gitActionChanged(recorded.receipt);
        },
      );
      const operationAbandon = Effect.fn('RunGitActionUseCase.abandon')(
        function* (run: GitActionRun, error: unknown): Effect.fn.Return<void> {
          return yield* Effect.gen(function* () {
            const { requestId } = run;
            loggerCapability.failure({ kind: 'git-action', requestId, error });
            const receipt = yield* interruptGitActionCapability.execute({
              requestId,
            });
            yield* eventsCapability.gitActionChanged(receipt);
          }).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() =>
                loggerCapability.failure({
                  kind: 'git-action',
                  requestId: run.requestId,
                  error: Cause.squash(cause),
                }),
              ),
            ),
          );
        },
      );
      return {
        execute: Effect.fn('RunGitActionUseCase.execute')(function* (
          input: WorktreeParams & RunGitActionRequest,
        ): Effect.fn.Return<
          RunGitActionResponse,
          | WorktreeAccessFailure
          | Effect.Error<
              ReturnType<
                Context.Service.Shape<typeof AcceptGitActionService>['execute']
              >
            >
        > {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              (worktree) => Effect.succeed(worktree),
              (worktree) =>
                Effect.gen(function* () {
                  const { upstreamOid, ...expected } = input.expected;
                  yield* expireGitActionReceiptsCapability.execute({
                    worktreeId: input.worktreeId,
                  });
                  const accepted = yield* acceptGitActionCapability.execute({
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
                Effect.gen(function* () {
                  if (accepted.kind !== 'accepted') return;
                  yield* eventsCapability.gitActionChanged(accepted.receipt);
                  yield* accessCapability.background(
                    worktree,
                    () => operationSettle(accepted.run),
                    (cause) =>
                      lanesCapability.finish(
                        laneKeysCapability.receipts(worktree),
                        () =>
                          operationAbandon(accepted.run, Cause.squash(cause)),
                      ),
                    optionsCapability,
                  );
                }),
              { requireAvailableProject: true },
            )
            .pipe(Effect.map(({ accepted }) => accepted.receipt));
        }),
      };
    }),
  );
}
