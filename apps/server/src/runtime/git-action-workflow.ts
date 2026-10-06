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
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  queuedGitActionRunSchema,
  type QueueGitActionInput,
} from '@porcelain/git-actions/models';
import { GitActionQueueRunner } from '../ports/git-action-queue-runner.ts';
import { RunQueuedGitActionUseCasePort } from '../ports/run-queued-git-action-use-case-port.ts';
import { ApplicationClosedError } from './errors/application-closed-error.ts';

const gitActionWorkflow = Workflow.make('PorcelainGitActionV1', {
  payload: queuedGitActionRunSchema,
  success: Schema.Void,
  error: Schema.Never,
  idempotencyKey: ({ requestId, acceptedAt }) => `${requestId}:${acceptedAt}`,
});

export class GitActionWorkflow extends Context.Service<
  GitActionWorkflow,
  {
    readonly execute: (input: QueueGitActionInput) => Effect.Effect<void>;
    readonly recover: () => Effect.Effect<void>;
    readonly stop: () => Effect.Effect<void>;
  }
>()('@porcelain/server/GitActionWorkflow') {
  static readonly layer = Layer.effectContext(
    Effect.gen(function* () {
      const engine = yield* WorkflowEngine.WorkflowEngine;
      const receipts = yield* GitActionReceiptStore;
      const queued = yield* RunQueuedGitActionUseCasePort;
      const registrationScope = yield* Scope.make();
      const stopped = yield* Ref.make(false);
      const stop = Effect.fn('GitActionWorkflow.stop')(function* () {
        yield* Ref.set(stopped, true);
        yield* Scope.close(registrationScope, Exit.void);
      });
      yield* Effect.addFinalizer(() => stop());
      yield* engine
        .register(gitActionWorkflow, (input) =>
          Activity.make({
            name: 'ApplyGitActionV1',
            success: Schema.Void,
            error: Schema.Never,
            execute: queued.execute(input),
            interruptRetryPolicy: Schedule.recurs(0),
          }).annotate(ClusterSchema.WithTransaction, false),
        )
        .pipe(Scope.provide(registrationScope));
      const execute = Effect.fn('GitActionWorkflow.execute')(function* (
        input: QueueGitActionInput,
      ) {
        if (yield* Ref.get(stopped))
          return yield* Effect.die(new ApplicationClosedError());
        const receipt = yield* receipts.read(input);
        if (!receipt || receipt.state !== 'running') return;
        yield* gitActionWorkflow
          .execute(
            { ...input, kind: 'run', acceptedAt: receipt.acceptedAt },
            { discard: true },
          )
          .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
      });
      const recover = Effect.fn('GitActionWorkflow.recover')(function* () {
        for (const receipt of yield* receipts.running()) {
          const input = {
            kind: 'run' as const,
            requestId: receipt.requestId,
            acceptedAt: receipt.acceptedAt,
          };
          const executionId = yield* gitActionWorkflow.executionId(input);
          const result = yield* engine.poll(gitActionWorkflow, executionId);
          if (Option.isSome(result) && result.value._tag === 'Complete') {
            const cause = Exit.isFailure(result.value.exit)
              ? result.value.exit.cause
              : Cause.die(
                  new Error(
                    'Workflow completed without a terminal Git receipt',
                  ),
                );
            yield* queued.execute({ ...input, kind: 'recover', cause });
          } else if (
            Option.isSome(result) &&
            result.value._tag === 'Suspended'
          ) {
            yield* engine.resume(gitActionWorkflow, executionId);
          } else yield* execute(input);
        }
      });
      return Context.make(GitActionWorkflow, { execute, recover, stop }).pipe(
        Context.add(GitActionQueueRunner, { execute }),
      );
    }),
  );
}
