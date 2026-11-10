import { Lanes } from './lanes.ts';
import { LaneKeys } from './lane-keys.ts';
import {
  Context,
  Effect,
  Exit,
  Layer,
  Schedule,
  Schema,
  Scope,
  Semaphore,
} from 'effect';
import { Activity, Workflow, WorkflowEngine } from 'effect/workflow';
import { ClusterSchema } from 'effect/cluster';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import {
  WriteWalkthroughService,
  BeginWalkthroughService,
  AnswerWalkthroughMessageService,
} from '@porcelain/walkthroughs/services';
import { WalkthroughQueue } from '../ports/walkthrough-queue.ts';
import { WalkthroughAnswerQueue } from '../ports/walkthrough-answer-queue.ts';
import { AnnounceWalkthroughUseCasePort } from '../ports/announce-walkthrough-use-case-port.ts';
const workflow = Workflow.make('PorcelainWalkthroughV1', {
  payload: { id: Schema.String },
  success: Schema.Void,
  error: Schema.Never,
  idempotencyKey: ({ id }) => id,
});
export class WalkthroughWorkflow extends Context.Service<
  WalkthroughWorkflow,
  {
    readonly execute: (id: string) => Effect.Effect<void>;
    readonly recover: () => Effect.Effect<void>;
    readonly stop: () => Effect.Effect<void>;
  }
>()('@porcelain/server/WalkthroughWorkflow') {
  static readonly layer = Layer.effectContext(
    Effect.gen(function* () {
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const engine = yield* WorkflowEngine.WorkflowEngine;
      const store = yield* WalkthroughStore;
      const writer = yield* WriteWalkthroughService;
      const begin = yield* BeginWalkthroughService;
      const answers = yield* AnswerWalkthroughMessageService;
      const events = yield* AnnounceWalkthroughUseCasePort;
      const scope = yield* Scope.make();
      const serial = yield* Semaphore.make(1);
      const stop = Effect.fn('WalkthroughWorkflow.stop')(() =>
        Scope.close(scope, Exit.void),
      );
      yield* Effect.addFinalizer(() => stop());
      yield* engine
        .register(workflow, ({ id }) =>
          Activity.make({
            name: 'WriteWalkthroughV1',
            success: Schema.Void,
            error: Schema.Never,
            interruptRetryPolicy: Schedule.recurs(0),
            execute: serial.withPermits(1)(
              lanes.run(
                keys.walkthroughs(),
                'write',
                () =>
                  Effect.gen(function* () {
                    const job = (yield* store.listPending()).find(
                      (item) => item.run.id === id,
                    );
                    if (!job || job.run.state.status !== 'queued') return;
                    if (!(yield* begin.execute(id))) return;
                    yield* events.execute({ worktreeId: job.run.worktreeId });
                    yield* writer.execute(job).pipe(
                      Effect.ensuring(
                        events.execute({
                          worktreeId: job.run.worktreeId,
                        }),
                      ),
                    );
                  }),
                { deadlineMs: 46 * 60 * 1000 },
              ),
            ),
          }).annotate(ClusterSchema.WithTransaction, false),
        )
        .pipe(Scope.provide(scope));
      const execute = Effect.fn('WalkthroughWorkflow.execute')(function* (
        id: string,
      ) {
        yield* workflow
          .execute({ id }, { discard: true })
          .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
      });
      const answerNext = Effect.fn('WalkthroughWorkflow.answerNext')(
        function* () {
          yield* lanes.background(
            keys.walkthroughs(),
            () =>
              answers.execute().pipe(
                Effect.flatMap((worktreeId) =>
                  worktreeId === undefined
                    ? Effect.void
                    : events.execute({
                        worktreeId,
                        change: 'walkthrough-conversations',
                      }),
                ),
              ),
            () => Effect.void,
            { deadlineMs: 7 * 60 * 1000 },
          );
        },
      );
      const recover = Effect.fn('WalkthroughWorkflow.recover')(function* () {
        const interrupted = yield* lanes.run(keys.walkthroughs(), 'write', () =>
          store.failAnswering({
            kind: 'other',
            message: 'This answer was interrupted. Ask again.',
          }),
        );
        for (const worktreeId of interrupted)
          yield* events.execute({
            worktreeId,
            change: 'walkthrough-conversations',
          });
        for (const job of yield* store.listPending()) {
          if (job.run.state.status === 'running') {
            yield* lanes.run(keys.walkthroughs(), 'write', () =>
              store.save({
                ...job.run,
                state: {
                  status: 'failed',
                  failure: {
                    kind: 'other',
                    message:
                      'The server stopped while this walkthrough was running. The interrupted writer was not restarted.',
                  },
                },
              }),
            );
            yield* events.execute({
              worktreeId: job.run.worktreeId,
            });
          } else yield* execute(job.run.id);
        }
      });
      return Context.make(WalkthroughWorkflow, { execute, recover, stop }).pipe(
        Context.add(WalkthroughQueue, { execute }),
        Context.add(WalkthroughAnswerQueue, { execute: answerNext }),
      );
    }),
  );
}
