import { makeLaneAdmission, withLaneAdmission } from './lane-admission.ts';
import { LaneOptions } from '../ports/lane-options.ts';
import {
  type Cause,
  Context,
  Effect,
  Layer,
  Deferred,
  Fiber,
  Scope,
  Exit,
  RcMap,
} from 'effect';
import { withSignal } from '@porcelain/effects';
import { channel } from 'node:diagnostics_channel';
import { type ListedWorktree } from '@porcelain/projects/models';
import { type WorktreeChangedError } from '@porcelain/kernel/errors';

import { ApplicationClosedError } from './errors/application-closed-error.ts';

const operationChannel = channel('porcelain:operation');

type OperationEvent = {
  runner: string;
  operation: number;
  phase: 'queued' | 'started' | 'settled';
  failed?: boolean;
};

let sequence = 0;

type LaneMode = 'read' | 'write';

export class Lanes extends Context.Service<
  Lanes,
  {
    readonly assertOpen: () => void;
    readonly run: <A, E>(
      lane: string,
      mode: LaneMode,
      work: () => Effect.Effect<A, E>,
      options?: {
        deadlineMs?: number;
        settled?: (() => Effect.Effect<void>) | undefined;
      },
    ) => Effect.Effect<A, E>;
    readonly commit: <A, E>(
      lane: string,
      work: () => Effect.Effect<A, E>,
      committed: (value: A) => Effect.Effect<void>,
    ) => Effect.Effect<A, E>;
    readonly transaction: <Prepared, A, E, F>(
      lane: string,
      prepare: () => Effect.Effect<Prepared, E>,
      commit: (prepared: Prepared) => Effect.Effect<A, F>,
      committed: (value: A) => Effect.Effect<void>,
    ) => Effect.Effect<A, E | F>;
    readonly unqueued: <A, E>(
      work: () => Effect.Effect<A, E>,
      options?: { deadlineMs?: number },
    ) => Effect.Effect<A, E>;
    readonly background: <E>(
      lane: string,
      work: () => Effect.Effect<void, E>,
      onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
      options?: { deadlineMs?: number },
    ) => Effect.Effect<void>;
    readonly finish: <A, E>(
      lane: string,
      work: () => Effect.Effect<A, E>,
    ) => Effect.Effect<A, E>;
    readonly start: <E>(
      work: () => Effect.Effect<void, E>,
      onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
    ) => Effect.Effect<void>;
    readonly runConsistent: <A, E>(
      lane: string,
      worktree: ListedWorktree,
      work: () => Effect.Effect<A, E>,
    ) => Effect.Effect<A, E | WorktreeChangedError>;
    readonly close: () => Promise<void>;
  }
>()('@porcelain/server/Lanes') {
  static readonly layer = Layer.effect(
    Lanes,
    Effect.gen(function* () {
      const options = yield* LaneOptions;
      const shutdown = new AbortController();
      const scope = Scope.makeUnsafe();
      const finishing = new Set<Deferred.Deferred<void>>();
      let closed = false;

      const admissionScope = yield* Scope.make();
      const admissions = yield* RcMap.make({
        lookup: () => makeLaneAdmission(options.readCapacity),
        idleTimeToLive: 0,
      }).pipe(Scope.provide(admissionScope));
      const configuredDeadlineMs = options.deadlineMs;
      const deadlineMs =
        typeof configuredDeadlineMs === 'function'
          ? configuredDeadlineMs
          : () => configuredDeadlineMs;
      const closeResources = options.closeResources ?? (() => undefined);
      const consistency = options.consistency;

      let closing: Promise<void> | undefined;
      function assertOpen(): void {
        if (shutdown.signal.aborted) throw new ApplicationClosedError();
      }
      function run<A, E>(
        lane: string,
        mode: LaneMode,
        work: () => Effect.Effect<A, E>,
        options: {
          deadlineMs?: number;
          settled?: (() => Effect.Effect<void>) | undefined;
        } = {},
      ): Effect.Effect<A, E> {
        return runEffect(lane, mode, work, {
          ...options,
          completed: options.settled,
        });
      }
      function commit<A, E>(
        lane: string,
        work: () => Effect.Effect<A, E>,
        committed: (value: A) => Effect.Effect<void>,
      ): Effect.Effect<A, E> {
        return transaction(lane, () => Effect.void, work, committed);
      }
      function transaction<Prepared, A, E, F>(
        lane: string,
        prepare: () => Effect.Effect<Prepared, E>,
        commit: (prepared: Prepared) => Effect.Effect<A, F>,
        committed: (value: A) => Effect.Effect<void>,
      ): Effect.Effect<A, E | F> {
        return Effect.suspend(() => {
          let confirmed: { value: A } | undefined;
          return runEffect(
            lane,
            'write',
            () =>
              Effect.uninterruptibleMask((restore) =>
                Effect.gen(function* () {
                  const prepared = yield* restore(Effect.suspend(prepare));
                  const value = yield* commit(prepared);
                  confirmed = { value };
                  return value;
                }),
              ),
            {
              completed: () =>
                confirmed ? committed(confirmed.value) : Effect.void,
            },
          );
        });
      }
      function runEffect<A, E>(
        lane: string,
        mode: LaneMode,
        work: () => Effect.Effect<A, E>,
        options: {
          deadlineMs?: number;
          completed?: (() => Effect.Effect<void>) | undefined;
        },
      ): Effect.Effect<A, E> {
        return Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            assertOpen();
            const id = ++sequence;
            publish(id, lane, 'queued');
            return yield* admittedEffect(
              id,
              lane,
              work,
              restore,
              mode,
              options,
            );
          }),
        );
      }
      function unqueued<A, E>(
        work: () => Effect.Effect<A, E>,
        options: { deadlineMs?: number } = {},
      ): Effect.Effect<A, E> {
        return Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            assertOpen();
            return yield* admittedEffect(
              ++sequence,
              'unqueued',
              work,
              restore,
              undefined,
              options,
            );
          }),
        );
      }
      function background<E>(
        lane: string,
        work: () => Effect.Effect<void, E>,
        onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
        options: { deadlineMs?: number } = {},
      ): Effect.Effect<void> {
        return Effect.forkIn(
          run(lane, 'write', work, options).pipe(
            Effect.onExit((exit) =>
              Exit.isFailure(exit) ? onFailure(exit.cause) : Effect.void,
            ),
          ),
          scope,
          { startImmediately: true },
        ).pipe(Effect.asVoid);
      }
      function finish<A, E>(
        lane: string,
        work: () => Effect.Effect<A, E>,
      ): Effect.Effect<A, E> {
        return Effect.uninterruptible(
          Effect.gen(function* () {
            if (closed) return yield* Effect.die(new ApplicationClosedError());
            const completed = yield* Deferred.make<void>();
            finishing.add(completed);
            const operation = Effect.gen(function* () {
              const admission = yield* RcMap.get(admissions, lane);
              return yield* withLaneAdmission(
                admission,
                'write',
                Effect.suspend(work),
              );
            }).pipe(Effect.scoped);
            return yield* operation.pipe(
              Effect.ensuring(
                Effect.gen(function* () {
                  finishing.delete(completed);
                  yield* Deferred.succeed(completed, undefined);
                }),
              ),
            );
          }),
        );
      }
      function start<E>(
        work: () => Effect.Effect<void, E>,
        onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
      ): Effect.Effect<void> {
        return Effect.forkIn(
          Effect.suspend(work).pipe(
            Effect.onExit((exit) =>
              Exit.isFailure(exit) ? onFailure(exit.cause) : Effect.void,
            ),
          ),
          scope,
          { startImmediately: true },
        ).pipe(Effect.asVoid);
      }
      function admittedEffect<A, E>(
        id: number,
        lane: string,
        work: () => Effect.Effect<A, E>,
        restore: <B, F, R>(
          effect: Effect.Effect<B, F, R>,
        ) => Effect.Effect<B, F, R>,
        mode: LaneMode | undefined,
        options: {
          deadlineMs?: number;
          completed?: (() => Effect.Effect<void>) | undefined;
        },
      ): Effect.Effect<A, E> {
        return Effect.gen(function* () {
          const admitted = yield* Deferred.make<void>();
          let started = false;
          const operation = Effect.gen(function* () {
            assertOpen();
            publish(id, lane, 'started');
            started = true;
            yield* Deferred.succeed(admitted, undefined);
            return yield* Effect.suspend(work);
          });
          const owned =
            mode === undefined
              ? operation
              : Effect.gen(function* () {
                  const admission = yield* RcMap.get(admissions, lane);
                  return yield* withLaneAdmission(admission, mode, operation);
                }).pipe(Effect.scoped);
          const worker = yield* Effect.forkIn(
            Effect.interruptible(owned).pipe(
              Effect.onExit((exit) =>
                Effect.gen(function* () {
                  if (!started) return;
                  publish(id, lane, 'settled', Exit.isFailure(exit));
                  if (options.completed) yield* options.completed();
                }),
              ),
            ),
            scope,
            { startImmediately: true },
          );
          const awaited = Effect.gen(function* () {
            yield* Effect.raceFirst(
              Deferred.await(admitted),
              Effect.asVoid(Fiber.join(worker)),
            );
            const timeout = Effect.sleep(
              options.deadlineMs ?? deadlineMs(),
            ).pipe(
              Effect.andThen(
                Effect.die(
                  new DOMException(
                    'The operation exceeded its deadline',
                    'TimeoutError',
                  ),
                ),
              ),
            );
            return yield* Effect.raceFirst(Fiber.join(worker), timeout);
          });
          return yield* restore(withSignal(awaited, shutdown.signal)).pipe(
            Effect.onExit(() => Effect.sync(() => worker.interruptUnsafe())),
          );
        });
      }
      function runConsistent<A, E>(
        lane: string,
        worktree: ListedWorktree,
        work: () => Effect.Effect<A, E>,
      ): Effect.Effect<A, E | WorktreeChangedError> {
        return run(lane, 'read', () =>
          work().pipe(Effect.tap(() => consistency.execute({ worktree }))),
        );
      }
      function publish(
        operation: number,
        runner: string,
        phase: OperationEvent['phase'],
        failed?: boolean,
      ) {
        if (!operationChannel.hasSubscribers) return;
        const event: OperationEvent = { runner, operation, phase };
        if (failed !== undefined) event.failed = failed;
        operationChannel.publish(event);
      }
      function close(): Promise<void> {
        if (!closing) {
          shutdown.abort(new ApplicationClosedError());
          closing = (async () => {
            await Effect.runPromise(Scope.close(scope, Exit.void));
            while (finishing.size > 0)
              await Effect.runPromise(
                Effect.forEach([...finishing], Deferred.await, {
                  concurrency: 'unbounded',
                }),
              );
            closed = true;
            await Effect.runPromise(Scope.close(admissionScope, Exit.void));
            closeResources();
          })();
        }
        return closing;
      }
      return {
        assertOpen,
        run,
        commit,
        transaction,
        unqueued,
        background,
        finish,
        start,
        runConsistent,
        close,
      };
    }),
  );
}
