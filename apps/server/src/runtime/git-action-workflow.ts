import {
  Cause,
  Context,
  Effect,
  Exit,
  Layer,
  Option,
  Ref,
  Schedule,
  Schema,
  Scope,
} from 'effect';
import { Activity, Workflow, WorkflowEngine } from 'effect/workflow';
import { ClusterSchema } from 'effect/cluster';
import { FindProjectService } from '@porcelain/projects/services';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  BeginGitActionService,
  FinishGitActionService,
  InterruptGitActionService,
  ReadGitActionReceiptService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { EventPublisher } from '../ports/event-publisher.ts';
import { Logger } from '../ports/logger.ts';
import { RefreshWorktreeReviewUseCasePort } from '../ports/refresh-worktree-review-use-case-port.ts';
import { RunGitActionUseCaseOptions } from '../ports/run-git-action-use-case-options.ts';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import { LaneKeys } from './lane-keys.ts';
import { Lanes } from './lanes.ts';
import { WorktreeAccess } from './worktree-access.ts';

const gitActionWorkflow = Workflow.make('PorcelainGitActionV1', {
  payload: { requestId: Schema.String, acceptedAt: Schema.String },
  success: Schema.Void,
  error: Schema.Never,
  idempotencyKey: ({ requestId, acceptedAt }) => `${requestId}:${acceptedAt}`,
});

export class GitActionWorkflow extends Context.Service<
  GitActionWorkflow,
  {
    readonly execute: (input: { requestId: string }) => Effect.Effect<void>;
    readonly recover: () => Effect.Effect<void>;
    readonly stop: () => Effect.Effect<void>;
  }
>()('@porcelain/server/GitActionWorkflow') {
  static readonly layer = Layer.effect(
    GitActionWorkflow,
    Effect.gen(function* () {
      const engine = yield* WorkflowEngine.WorkflowEngine;
      const receipts = yield* GitActionReceiptStore;
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
      const registrationScope = yield* Scope.make();
      const stopped = yield* Ref.make(false);

      const stop = Effect.fn('GitActionWorkflow.stop')(function* () {
        yield* Ref.set(stopped, true);
        // Unregistering the native entity drains activities while lanes and SQL
        // are still open. The application also calls stop before closing lanes.
        yield* Scope.close(registrationScope, Exit.void);
      });
      yield* Effect.addFinalizer(() => stop());

      const interrupt = Effect.fn('GitActionWorkflow.interrupt')(function* (
        requestId: string,
        cause: Cause.Cause<unknown>,
      ) {
        const receipt = yield* receipts.read({ requestId });
        if (receipt?.state !== 'running' && Cause.hasInterruptsOnly(cause))
          return;
        yield* Effect.sync(() =>
          logger.failure({
            kind: 'git-action',
            requestId,
            error: Cause.squash(cause),
          }),
        );
        if (!receipt || receipt.state !== 'running') return;
        const interrupted = yield* interruptAction
          .execute({ requestId })
          .pipe(Effect.orDie);
        yield* events.gitActionChanged(interrupted);
      });

      const interruptAdmitted = Effect.fn(
        'GitActionWorkflow.interruptAdmitted',
      )(function* (requestId: string, cause: Cause.Cause<unknown>) {
        const receipt = yield* receipts.read({ requestId });
        if (!receipt) return;
        const found = yield* lanes.run(keys.inventory(), 'read', () =>
          findProject.execute({ projectId: receipt.projectId }),
        );
        // Receipt ownership survives removal of worktree presence. A deleted
        // project cascades its receipts away; it never changes their lane.
        if (found.kind === 'missing') return;
        const worktree = {
          id: receipt.worktreeId,
          projectId: receipt.projectId,
          repositoryId: found.project.repositoryIdentity,
        };
        yield* lanes.finish(keys.receipts(worktree), () =>
          interrupt(requestId, cause),
        );
      });

      const perform = Effect.fn('GitActionWorkflow.perform')(function* (
        requestId: string,
        acceptedAt: string,
      ) {
        const receipt = yield* receipts.read({ requestId });
        if (
          !receipt ||
          receipt.state !== 'running' ||
          receipt.acceptedAt !== acceptedAt
        )
          return;
        yield* Effect.uninterruptibleMask((restore) =>
          restore(
            access
              .write(receipt.worktreeId, () =>
                Effect.uninterruptibleMask((restoreWrite) =>
                  Effect.gen(function* () {
                    // The fence is committed before any foreign Git IO. A crash
                    // after this point can never cause the write to run again.
                    const begun = yield* beginAction.execute({
                      requestId,
                      acceptedAt,
                    });
                    if (begun.kind === 'unavailable') {
                      yield* events.gitActionChanged(
                        yield* readReceipt
                          .execute({
                            requestId,
                            worktreeId: receipt.worktreeId,
                          })
                          .pipe(Effect.orDie),
                      );
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
                          onProgress: Effect.fn('GitActionWorkflow.progress')(
                            function* (line: string) {
                              const recorded = yield* recordProgress.execute({
                                requestId,
                                line,
                              });
                              if (recorded.kind === 'recorded')
                                yield* events.gitActionChanged(
                                  recorded.receipt,
                                );
                            },
                          ),
                        });
                      }),
                    );
                    // Receipt durability precedes the native Activity reply. If the
                    // reply is lost, replay observes this terminal receipt instead.
                    const finished = yield* finishAction
                      .execute({ requestId, outcome: ran.outcome })
                      .pipe(Effect.orDie);
                    yield* events.gitActionChanged(finished);
                  }).pipe(
                    Effect.catchCause((cause) => interrupt(requestId, cause)),
                  ),
                ),
              )
              .pipe(Effect.timeout(options.deadlineMs)),
          ).pipe(
            Effect.catchCause((cause) => interruptAdmitted(requestId, cause)),
          ),
        );
      });

      yield* engine
        .register(gitActionWorkflow, ({ requestId, acceptedAt }) =>
          Effect.gen(function* () {
            yield* Activity.make({
              name: 'ApplyGitActionV1',
              success: Schema.Void,
              error: Schema.Never,
              execute: perform(requestId, acceptedAt),
              // Activity's default interruption retry would be unsafe for Git.
              interruptRetryPolicy: Schedule.recurs(0),
            }).annotate(ClusterSchema.WithTransaction, false);
            const receipt = yield* receipts.read({ requestId });
            if (!receipt) return;
            if (
              receipt.state === 'succeeded' &&
              (receipt.action === 'commit' || receipt.action === 'amend')
            ) {
              yield* lanes.start(
                () => refreshReview.execute({ worktreeId: receipt.worktreeId }),
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
        )
        .pipe(Scope.provide(registrationScope));

      const execute = Effect.fn('GitActionWorkflow.execute')(function* (input: {
        requestId: string;
      }) {
        if (yield* Ref.get(stopped))
          return yield* Effect.die(new ApplicationClosedError());
        const receipt = yield* receipts.read(input);
        if (!receipt || receipt.state !== 'running') return;
        yield* gitActionWorkflow
          .execute(
            { ...input, acceptedAt: receipt.acceptedAt },
            { discard: true },
          )
          .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
      });

      return {
        execute,
        recover: Effect.fn('GitActionWorkflow.recover')(function* () {
          for (const receipt of yield* receipts.running()) {
            const input = { requestId: receipt.requestId };
            const executionId = yield* gitActionWorkflow.executionId({
              ...input,
              acceptedAt: receipt.acceptedAt,
            });
            const result = yield* engine.poll(gitActionWorkflow, executionId);
            // A stored native defect cannot be replayed into a second Git write.
            // Surface the ambiguous receipt even if the engine already finished.
            if (Option.isSome(result) && result.value._tag === 'Complete') {
              const cause = Exit.isFailure(result.value.exit)
                ? result.value.exit.cause
                : Cause.die(
                    new Error(
                      'Workflow completed without a terminal Git receipt',
                    ),
                  );
              yield* interruptAdmitted(receipt.requestId, cause);
            } else if (
              Option.isSome(result) &&
              result.value._tag === 'Suspended'
            ) {
              // Re-enqueueing the same primary key only returns its stored
              // suspended reply. Native resume resets that reply for replay.
              yield* engine.resume(gitActionWorkflow, executionId);
            } else {
              yield* execute(input);
            }
          }
        }),
        stop,
      };
    }),
  );
}
