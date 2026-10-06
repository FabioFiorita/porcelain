import { Cause, Context, Effect, Layer } from 'effect';
import { FindProjectService } from '@porcelain/projects/services';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  type BeginGitActionInput,
  type QueuedGitActionInput,
} from '@porcelain/git-actions/models';
import {
  ReadQueuedGitActionService,
  BeginGitActionService,
  FinishGitActionService,
  InterruptGitActionService,
  ReadGitActionReceiptService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { Logger } from '../../ports/logger.ts';
import { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import { RunGitActionUseCaseOptions } from '../../ports/run-git-action-use-case-options.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';

export class RunQueuedGitActionUseCase extends Context.Service<
  RunQueuedGitActionUseCase,
  {
    readonly execute: (input: QueuedGitActionInput) => Effect.Effect<void>;
  }
>()('@porcelain/server/RunQueuedGitActionUseCase') {
  static readonly layer = Layer.effect(
    RunQueuedGitActionUseCase,
    Effect.gen(function* () {
      const readQueued = yield* ReadQueuedGitActionService;
      const access = yield* WorktreeAccess;
      const readStatus = yield* ReadWorktreeStatusService;
      const readFingerprints = yield* ReadChangeFingerprintsService;
      const runAction = yield* RunGitActionService;
      const beginAction = yield* BeginGitActionService;
      const readReceipt = yield* ReadGitActionReceiptService;
      const recordProgress = yield* RecordGitActionProgressService;
      const finishAction = yield* FinishGitActionService;
      const interruptAction = yield* InterruptGitActionService;
      const events = yield* EventPublisher;
      const refreshReview = yield* RefreshWorktreeReviewUseCasePort;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const findProject = yield* FindProjectService;
      const logger = yield* Logger;
      const options = yield* RunGitActionUseCaseOptions;
      const interrupt = Effect.fn('RunQueuedGitActionUseCase.interrupt')(
        function* (input: BeginGitActionInput, cause: Cause.Cause<unknown>) {
          const found = yield* readQueued.execute(input);
          if (found.kind === 'unavailable') return;
          const { receipt } = found;
          if (receipt.state !== 'running' && Cause.hasInterruptsOnly(cause))
            return;
          yield* Effect.sync(() =>
            logger.failure({
              kind: 'git-action',
              requestId: input.requestId,
              error: Cause.squash(cause),
            }),
          );
          if (receipt.state !== 'running') return;
          yield* interruptAction
            .execute({ requestId: input.requestId })
            .pipe(Effect.orDie);
        },
      );

      const interruptAdmitted = Effect.fn(
        'RunQueuedGitActionUseCase.interruptAdmitted',
      )(function* (input: BeginGitActionInput, cause: Cause.Cause<unknown>) {
        const queued = yield* readQueued.execute(input);
        if (queued.kind === 'unavailable') return;
        const { receipt } = queued;
        const found = yield* lanes.run(keys.inventory(), 'read', () =>
          findProject.execute({ projectId: receipt.projectId }),
        );
        if (found.kind === 'missing') return;
        const worktree = {
          id: receipt.worktreeId,
          projectId: receipt.projectId,
          repositoryId: found.project.repositoryIdentity,
        };
        yield* lanes.finish(keys.receipts(worktree), () =>
          interrupt(input, cause),
        );
      });

      const perform = Effect.fn('RunQueuedGitActionUseCase.perform')(function* (
        input: BeginGitActionInput,
      ) {
        const queued = yield* readQueued.execute(input);
        if (queued.kind === 'unavailable' || queued.receipt.state !== 'running')
          return;
        const { receipt } = queued;
        const { requestId, acceptedAt } = input;
        yield* Effect.uninterruptibleMask((restore) =>
          restore(
            access
              .write(receipt.worktreeId, () =>
                Effect.uninterruptibleMask((restoreWrite) =>
                  Effect.gen(function* () {
                    const begun = yield* beginAction.execute({
                      requestId,
                      acceptedAt,
                    });
                    if (begun.kind === 'unavailable') {
                      return;
                    }
                    const { run } = begun;
                    const ran = yield* restoreWrite(
                      Effect.gen(function* () {
                        const changes =
                          run.target.kind === 'unchecked'
                            ? []
                            : (yield* readFingerprints.execute({
                                worktreeId: run.worktreeId,
                                comparisons: (yield* readStatus.execute({
                                  worktreeId: run.worktreeId,
                                })).changes,
                                paths: run.target.paths,
                              })).changes;
                        return yield* runAction.execute({
                          run,
                          changes,
                          onProgress: (line) =>
                            Effect.gen(function* () {
                              const recorded = yield* recordProgress.execute({
                                requestId,
                                line,
                              });
                              if (recorded.kind === 'recorded')
                                yield* events.gitActionChanged(
                                  recorded.receipt,
                                );
                            }),
                        });
                      }),
                    );
                    yield* finishAction
                      .execute({ requestId, outcome: ran.outcome })
                      .pipe(Effect.orDie);
                  }).pipe(
                    Effect.catchCause((cause) => interrupt(input, cause)),
                  ),
                ),
              )
              .pipe(Effect.timeout(options.deadlineMs)),
          ).pipe(Effect.catchCause((cause) => interruptAdmitted(input, cause))),
        );
      });

      return {
        execute: Effect.fn('RunQueuedGitActionUseCase.execute')(function* (
          input: QueuedGitActionInput,
        ) {
          const before = yield* readQueued.execute(input);
          if (
            before.kind === 'unavailable' ||
            before.receipt.state !== 'running'
          )
            return;
          return yield* Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              if (input.kind === 'recover')
                yield* interruptAdmitted(input, input.cause);
              else
                yield* restore(perform(input)).pipe(
                  Effect.catchCause((cause) => interruptAdmitted(input, cause)),
                );
              const after = yield* readQueued.execute(input);
              if (after.kind === 'unavailable') return;
              const { receipt } = after;
              const found = yield* lanes.run(keys.inventory(), 'read', () =>
                findProject.execute({ projectId: receipt.projectId }),
              );
              if (found.kind === 'missing') return;
              const worktree = {
                id: receipt.worktreeId,
                projectId: receipt.projectId,
                repositoryId: found.project.repositoryIdentity,
              };
              const view = yield* lanes.finish(keys.receipts(worktree), () =>
                readReceipt
                  .execute({
                    requestId: receipt.requestId,
                    worktreeId: receipt.worktreeId,
                  })
                  .pipe(Effect.orDie),
              );
              yield* events.gitActionChanged(view);
              if (
                receipt.state === 'succeeded' &&
                (receipt.intent.action === 'commit' ||
                  receipt.intent.action === 'amend')
              ) {
                yield* lanes.start(
                  () =>
                    refreshReview.execute({ worktreeId: receipt.worktreeId }),
                  (cause) =>
                    Cause.hasInterruptsOnly(cause)
                      ? Effect.void
                      : Effect.sync(() =>
                          logger.failure({
                            kind: 'review-refresh',
                            worktreeId: receipt.worktreeId,
                            error: Cause.squash(cause),
                          }),
                        ),
                );
              }
            }),
          );
        }),
      };
    }),
  );
}
