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

type Waiter = {
  admit: () => void;
};

class Gate {
  private readonly capacity: number;
  private readers = 0;
  private writing = false;
  private readonly waitingReads: Waiter[] = [];
  private readonly waitingWrites: Waiter[] = [];

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get idle() {
    return (
      this.readers === 0 &&
      !this.writing &&
      this.waitingReads.length === 0 &&
      this.waitingWrites.length === 0
    );
  }

  private free(mode: LaneMode) {
    if (this.writing) return false;
    return mode === 'write'
      ? this.readers === 0
      : this.waitingWrites.length === 0 && this.readers < this.capacity;
  }

  private take(mode: LaneMode) {
    if (mode === 'write') this.writing = true;
    else this.readers += 1;
  }

  enterEffect(mode: LaneMode): Effect.Effect<() => void> {
    return Effect.callback((resume) => {
      let admitted = false;
      let released = false;
      const release = () => {
        if (!admitted || released) return;
        released = true;
        this.leave(mode);
      };
      if (this.free(mode)) {
        this.take(mode);
        admitted = true;
        resume(Effect.succeed(release));
        return Effect.sync(release);
      }
      const queue = mode === 'write' ? this.waitingWrites : this.waitingReads;
      const waiter: Waiter = {
        admit: () => {
          admitted = true;
          resume(Effect.succeed(release));
        },
      };
      queue.push(waiter);
      return Effect.sync(() => {
        if (admitted) return release();
        const index = queue.indexOf(waiter);
        if (index >= 0) queue.splice(index, 1);
        this.wake();
      });
    });
  }

  leave(mode: LaneMode) {
    if (mode === 'write') this.writing = false;
    else this.readers -= 1;
    this.wake();
  }

  private wake() {
    while (this.waitingWrites.length > 0 && this.free('write')) {
      const next = this.waitingWrites.shift();
      if (!next) return;
      this.take('write');
      next.admit();
    }
    while (this.waitingReads.length > 0 && this.free('read')) {
      const next = this.waitingReads.shift();
      if (!next) return;
      this.take('read');
      next.admit();
    }
  }
}

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
      const gates = new Map<string, Gate>();
      const shutdown = new AbortController();
      const scope = Scope.makeUnsafe();
      const finishing = new Set<Deferred.Deferred<void>>();
      let closed = false;

      const capacity = options.readCapacity;
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
      function getGate(lane: string) {
        const existing = gates.get(lane);
        if (existing) return existing;
        const created = new Gate(capacity);
        gates.set(lane, created);
        return created;
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
            const gate = getGate(lane);
            const id = ++sequence;
            publish(id, lane, 'queued');
            const release = yield* restore(
              withSignal(gate.enterEffect(mode), shutdown.signal),
            );
            return yield* admittedEffect(
              id,
              lane,
              work,
              restore,
              () => {
                release();
                if (gate.idle) gates.delete(lane);
              },
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
              () => undefined,
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
            const gate = getGate(lane);
            return yield* Effect.acquireUseRelease(
              gate.enterEffect('write'),
              () => Effect.suspend(work),
              (release) =>
                Effect.sync(() => {
                  release();
                  if (gate.idle) gates.delete(lane);
                }),
            ).pipe(
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
        settled: () => void,
        options: {
          deadlineMs?: number;
          completed?: (() => Effect.Effect<void>) | undefined;
        },
      ): Effect.Effect<A, E> {
        let worker: Fiber.Fiber<A, E> | undefined;
        return Effect.gen(function* () {
          assertOpen();
          publish(id, lane, 'started');
          const admitted = Effect.suspend(work).pipe(
            Effect.onExit((exit) =>
              Effect.gen(function* () {
                publish(id, lane, 'settled', Exit.isFailure(exit));
                settled();
                if (options.completed) yield* options.completed();
              }),
            ),
          );
          worker = yield* Effect.forkIn(admitted, scope, {
            startImmediately: true,
          });
          const timeout = Effect.sleep(options.deadlineMs ?? deadlineMs()).pipe(
            Effect.andThen(
              Effect.die(
                new DOMException(
                  'The operation exceeded its deadline',
                  'TimeoutError',
                ),
              ),
            ),
          );
          return yield* restore(
            withSignal(
              Effect.raceFirst(Fiber.join(worker), timeout),
              shutdown.signal,
            ),
          );
        }).pipe(
          Effect.onExit(() =>
            Effect.sync(() => {
              if (worker) worker.interruptUnsafe();
              else settled();
            }),
          ),
        );
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
