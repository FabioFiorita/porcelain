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
  Ref,
  TxRef,
} from 'effect';
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

type LaneMode = 'read' | 'write';

export class Lanes extends Context.Service<
  Lanes,
  {
    readonly assertOpen: () => Effect.Effect<void>;
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
    readonly close: () => Effect.Effect<void>;
  }
>()('@porcelain/server/Lanes') {
  static readonly layer = Layer.effect(
    Lanes,
    Effect.gen(function* () {
      const options = yield* LaneOptions;
      const shutdown = yield* Deferred.make<void>();
      const scope = yield* Scope.make();
      const sequence = yield* Ref.make(0);
      const lifecycle = yield* TxRef.make<{
        phase: 'open' | 'closing' | 'closed';
        finishing: number;
      }>({ phase: 'open', finishing: 0 });

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

      const assertOpen = Effect.fn('Lanes.assertOpen')(function* () {
        if ((yield* TxRef.get(lifecycle)).phase !== 'open')
          return yield* Effect.die(new ApplicationClosedError());
      });
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
            yield* assertOpen();
            const id = yield* Ref.updateAndGet(sequence, (value) => value + 1);
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
            yield* assertOpen();
            return yield* admittedEffect(
              yield* Ref.updateAndGet(sequence, (value) => value + 1),
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
            yield* Effect.gen(function* () {
              const current = yield* TxRef.get(lifecycle);
              if (current.phase === 'closed')
                return yield* Effect.die(new ApplicationClosedError());
              yield* TxRef.set(lifecycle, {
                ...current,
                finishing: current.finishing + 1,
              });
            }).pipe(Effect.tx);
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
                TxRef.update(lifecycle, (current) => ({
                  ...current,
                  finishing: current.finishing - 1,
                })),
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
            yield* assertOpen();
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
          return yield* restore(
            Effect.raceFirst(
              awaited,
              Deferred.await(shutdown).pipe(Effect.andThen(Effect.interrupt)),
            ),
          ).pipe(
            Effect.onExit(() => Fiber.interrupt(worker).pipe(Effect.asVoid)),
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
      const closing = yield* Effect.cached(
        Effect.uninterruptible(
          Effect.gen(function* () {
            yield* TxRef.update(lifecycle, (current) => ({
              ...current,
              phase: 'closing' as const,
            }));
            yield* Deferred.succeed(shutdown, undefined);
            yield* Scope.close(scope, Exit.void);
            yield* Effect.gen(function* () {
              const current = yield* TxRef.get(lifecycle);
              if (current.finishing > 0) return yield* Effect.txRetry;
              yield* TxRef.set(lifecycle, {
                ...current,
                phase: 'closed' as const,
              });
            }).pipe(Effect.tx);
            yield* Scope.close(admissionScope, Exit.void);
            yield* Effect.sync(closeResources);
          }),
        ),
      );
      yield* Effect.addFinalizer(() => closing);
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
        close: () => closing,
      };
    }),
  );
}
