import type { Cause } from 'effect';
import { Deferred, Effect, Fiber, Scope, Exit } from 'effect';
import { withSignal } from '@porcelain/effects';
import { channel } from 'node:diagnostics_channel';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
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

type LaneOptions = {
  readCapacity: number;
  deadlineMs: number | (() => number);
  consistency: WorktreeConsistencyProbe;
  closeResources?: () => void;
};

export class Lanes {
  private readonly gates = new Map<string, Gate>();
  private readonly capacity: number;
  private readonly deadlineMs: () => number;
  private readonly closeResources: () => void;
  private readonly consistency: WorktreeConsistencyProbe;
  private readonly shutdown = new AbortController();
  private readonly scope = Scope.makeUnsafe();
  private readonly finishing = new Set<Deferred.Deferred<void>>();
  private closed = false;
  private closing: Promise<void> | undefined;

  constructor(options: LaneOptions) {
    this.capacity = options.readCapacity;
    const { deadlineMs } = options;
    this.deadlineMs =
      typeof deadlineMs === 'function' ? deadlineMs : () => deadlineMs;
    this.closeResources = options.closeResources ?? (() => undefined);
    this.consistency = options.consistency;
  }

  assertOpen(): void {
    if (this.shutdown.signal.aborted) throw new ApplicationClosedError();
  }

  private gate(lane: string) {
    const existing = this.gates.get(lane);
    if (existing) return existing;
    const created = new Gate(this.capacity);
    this.gates.set(lane, created);
    return created;
  }

  run<A, E>(
    lane: string,
    mode: LaneMode,
    work: () => Effect.Effect<A, E>,
    options: {
      deadlineMs?: number;
      settled?: (() => Effect.Effect<void>) | undefined;
    } = {},
  ): Effect.Effect<A, E> {
    return this.runEffect(lane, mode, work, {
      ...options,
      completed: options.settled,
    });
  }

  commit<A, E>(
    lane: string,
    work: () => Effect.Effect<A, E>,
    committed: (value: A) => Effect.Effect<void>,
  ): Effect.Effect<A, E> {
    return this.transaction(lane, () => Effect.void, work, committed);
  }

  transaction<Prepared, A, E, F>(
    lane: string,
    prepare: () => Effect.Effect<Prepared, E>,
    commit: (prepared: Prepared) => Effect.Effect<A, F>,
    committed: (value: A) => Effect.Effect<void>,
  ): Effect.Effect<A, E | F> {
    return Effect.suspend(() => {
      let confirmed: { value: A } | undefined;
      return this.runEffect(
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

  private runEffect<A, E>(
    lane: string,
    mode: LaneMode,
    work: () => Effect.Effect<A, E>,
    options: {
      deadlineMs?: number;
      completed?: (() => Effect.Effect<void>) | undefined;
    },
  ): Effect.Effect<A, E> {
    return Effect.uninterruptibleMask((restore) =>
      Effect.gen({ self: this }, function* () {
        this.assertOpen();
        const gate = this.gate(lane);
        const id = ++sequence;
        this.publish(id, lane, 'queued');
        const release = yield* restore(
          withSignal(gate.enterEffect(mode), this.shutdown.signal),
        );
        return yield* this.admittedEffect(
          id,
          lane,
          work,
          restore,
          () => {
            release();
            if (gate.idle) this.gates.delete(lane);
          },
          options,
        );
      }),
    );
  }

  unqueued<A, E>(
    work: () => Effect.Effect<A, E>,
    options: { deadlineMs?: number } = {},
  ): Effect.Effect<A, E> {
    return Effect.uninterruptibleMask((restore) =>
      Effect.gen({ self: this }, function* () {
        this.assertOpen();
        return yield* this.admittedEffect(
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

  background<E>(
    lane: string,
    work: () => Effect.Effect<void, E>,
    onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
    options: { deadlineMs?: number } = {},
  ): Effect.Effect<void> {
    return Effect.forkIn(
      this.run(lane, 'write', work, options).pipe(
        Effect.onExit((exit) =>
          Exit.isFailure(exit) ? onFailure(exit.cause) : Effect.void,
        ),
      ),
      this.scope,
      { startImmediately: true },
    ).pipe(Effect.asVoid);
  }

  finish<A, E>(
    lane: string,
    work: () => Effect.Effect<A, E>,
  ): Effect.Effect<A, E> {
    return Effect.uninterruptible(
      Effect.gen({ self: this }, function* () {
        if (this.closed) return yield* Effect.die(new ApplicationClosedError());
        const completed = yield* Deferred.make<void>();
        this.finishing.add(completed);
        const gate = this.gate(lane);
        return yield* Effect.acquireUseRelease(
          gate.enterEffect('write'),
          () => Effect.suspend(work),
          (release) =>
            Effect.sync(() => {
              release();
              if (gate.idle) this.gates.delete(lane);
            }),
        ).pipe(
          Effect.ensuring(
            Effect.gen({ self: this }, function* () {
              this.finishing.delete(completed);
              yield* Deferred.succeed(completed, undefined);
            }),
          ),
        );
      }),
    );
  }

  start<E>(
    work: () => Effect.Effect<void, E>,
    onFailure: (cause: Cause.Cause<E>) => Effect.Effect<void>,
  ): Effect.Effect<void> {
    return Effect.forkIn(
      Effect.suspend(work).pipe(
        Effect.onExit((exit) =>
          Exit.isFailure(exit) ? onFailure(exit.cause) : Effect.void,
        ),
      ),
      this.scope,
      { startImmediately: true },
    ).pipe(Effect.asVoid);
  }

  private admittedEffect<A, E>(
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
    return Effect.gen({ self: this }, function* () {
      this.assertOpen();
      this.publish(id, lane, 'started');
      const admitted = Effect.suspend(work).pipe(
        Effect.onExit((exit) =>
          Effect.gen({ self: this }, function* () {
            this.publish(id, lane, 'settled', Exit.isFailure(exit));
            settled();
            if (options.completed) yield* options.completed();
          }),
        ),
      );
      worker = yield* Effect.forkIn(admitted, this.scope, {
        startImmediately: true,
      });
      const timeout = Effect.sleep(
        options.deadlineMs ?? this.deadlineMs(),
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
      return yield* restore(
        withSignal(
          Effect.raceFirst(Fiber.join(worker), timeout),
          this.shutdown.signal,
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

  runConsistent<A, E>(
    lane: string,
    worktree: ListedWorktree,
    work: () => Effect.Effect<A, E>,
  ): Effect.Effect<A, E | WorktreeChangedError> {
    return this.run(lane, 'read', () =>
      work().pipe(Effect.tap(() => this.consistency.execute({ worktree }))),
    );
  }

  private publish(
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

  close(): Promise<void> {
    if (!this.closing) {
      this.shutdown.abort(new ApplicationClosedError());
      this.closing = (async () => {
        await Effect.runPromise(Scope.close(this.scope, Exit.void));
        while (this.finishing.size > 0)
          await Effect.runPromise(
            Effect.forEach([...this.finishing], Deferred.await, {
              concurrency: 'unbounded',
            }),
          );
        this.closed = true;
        this.closeResources();
      })();
    }
    return this.closing;
  }
}
