import { channel } from 'node:diagnostics_channel';
import { ApplicationClosedError } from './errors/application-closed-error.ts';

/**
 * Queue events for development tooling, such as time spent waiting behind other
 * operations. Nothing is published without a subscriber.
 */
const operationChannel = channel('porcelain:operation');

export type OperationEvent = {
  runner: string;
  operation: number;
  phase: 'queued' | 'started' | 'settled';
  failed?: boolean;
};

let sequence = 0;

export type LaneMode = 'read' | 'write';

/**
 * A caller's place in a lane. It is passed down composite work so nested reads
 * reuse the admission the caller already holds; asking for a second one inside
 * a lane would wait for work that cannot start until the caller returns.
 */
export type Admission = {
  readonly lane: string;
  readonly mode: LaneMode;
  /** Aborts on the work's own deadline, the caller leaving, or shutdown. */
  readonly signal: AbortSignal;
};

type Waiter = {
  admit: () => void;
  refuse: (reason: unknown) => void;
  detach: () => void;
};

/**
 * One repository's gate. Reads run side by side up to `capacity`; a write runs
 * alone. It is writer-preferring: while a write is waiting, arriving reads
 * queue behind it, so a stream of reads cannot keep a commit out indefinitely.
 *
 * Readers and writers queue separately. One queue with a writer-preference
 * rule deadlocks: the head of the queue can be a read that the rule refuses,
 * with no way to reach the writer behind it.
 */
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

  enter(mode: LaneMode, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.free(mode)) {
      this.take(mode);
      return Promise.resolve();
    }
    const queue = mode === 'write' ? this.waitingWrites : this.waitingReads;
    return new Promise<void>((resolve, reject) => {
      const leave = () => {
        const index = queue.indexOf(waiter);
        if (index >= 0) queue.splice(index, 1);
        waiter.detach();
        reject(signal?.reason);
        // A cancelled writer may have been the only thing holding reads back.
        this.wake();
      };
      const waiter: Waiter = {
        admit: resolve,
        refuse: reject,
        detach: () => signal?.removeEventListener('abort', leave),
      };
      signal?.addEventListener('abort', leave, { once: true });
      queue.push(waiter);
    });
  }

  leave(mode: LaneMode) {
    if (mode === 'write') this.writing = false;
    else this.readers -= 1;
    this.wake();
  }

  private wake() {
    // Writers first, so a waiting write is never overtaken by later reads.
    while (this.waitingWrites.length > 0 && this.free('write')) {
      const next = this.waitingWrites.shift();
      if (!next) return;
      next.detach();
      this.take('write');
      next.admit();
    }
    while (this.waitingReads.length > 0 && this.free('read')) {
      const next = this.waitingReads.shift();
      if (!next) return;
      next.detach();
      this.take('read');
      next.admit();
    }
  }
}

export type LaneOptions = {
  /** How many reads one repository runs side by side. */
  readCapacity?: number;
  /**
   * The execution budget, counted from admission rather than from arrival.
   *
   * A function, because the budget has to cover whatever the work may reach
   * for: any worktree request can end up listing every project when the id it
   * names is one the directory has not seen, and how long that takes depends
   * on how many projects there are.
   */
  deadlineMs: number | (() => number);
  closeResources?: () => void;
};

/**
 * One lane per repository, plus an unkeyed lane for filesystem work that
 * belongs to no repository. Database work never enters a lane at all.
 */
export class Lanes {
  private readonly gates = new Map<string, Gate>();
  private readonly capacity: number;
  private readonly deadlineMs: () => number;
  private readonly closeResources: () => void;
  private readonly shutdown = new AbortController();
  private active = new Set<Promise<unknown>>();
  private closing: Promise<void> | undefined;

  constructor(options: LaneOptions) {
    this.capacity = options.readCapacity ?? 4;
    this.deadlineMs =
      typeof options.deadlineMs === 'function'
        ? options.deadlineMs
        : () => options.deadlineMs as number;
    this.closeResources = options.closeResources ?? (() => undefined);
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

  /**
   * Runs work in a lane. `lane` is a repository identity, or `'filesystem'`
   * for work that belongs to no repository.
   */
  async run<T>(
    lane: string,
    mode: LaneMode,
    work: (admission: Admission) => Promise<T>,
    options: {
      callerSignal?: AbortSignal | undefined;
      deadlineMs?: number | undefined;
      /**
       * A Git action keeps going once started, so its receipt is never left
       * half recorded. Everything else stops when its caller leaves.
       */
      untilSettled?: boolean | undefined;
    } = {},
  ): Promise<T> {
    this.assertOpen();
    const { callerSignal } = options;
    const waiting = AbortSignal.any([
      this.shutdown.signal,
      ...(callerSignal ? [callerSignal] : []),
    ]);
    const gate = this.gate(lane);
    const id = ++sequence;
    this.publish(id, lane, 'queued');
    await gate.enter(mode, waiting);
    // The deadline starts here, so waiting behind other work never spends a
    // caller's execution budget.
    const signal = AbortSignal.any([
      waiting,
      AbortSignal.timeout(options.deadlineMs ?? this.deadlineMs()),
    ]);
    this.publish(id, lane, 'started');
    let task: Promise<T>;
    try {
      // Inside the guard: a synchronous throw must not keep the permit.
      task = Promise.resolve(work({ lane, mode, signal }));
    } catch (cause) {
      gate.leave(mode);
      if (gate.idle) this.gates.delete(lane);
      this.publish(id, lane, 'settled', true);
      throw cause;
    }
    this.track(task);
    // The permit is held until the work has actually stopped, so a cancelled
    // read cannot let a write start while it is still running. The caller is
    // answered as soon as it leaves; the lane waits for the work itself.
    void task.then(
      () => {
        this.publish(id, lane, 'settled', false);
        gate.leave(mode);
        if (gate.idle) this.gates.delete(lane);
      },
      () => {
        this.publish(id, lane, 'settled', true);
        gate.leave(mode);
        if (gate.idle) this.gates.delete(lane);
      },
    );
    return options.untilSettled ? task : this.until(task, signal);
  }

  /** Rejects as soon as the caller leaves, even if the work ignores its signal. */
  private until<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const leave = () => reject(signal.reason);
      if (signal.aborted) return leave();
      signal.addEventListener('abort', leave, { once: true });
      task
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', leave));
    });
  }

  /** Work with no lane: it is supervised for shutdown, but never queued. */
  async unqueued<T>(
    work: (signal: AbortSignal) => Promise<T>,
    options: {
      callerSignal?: AbortSignal | undefined;
      deadlineMs?: number | undefined;
    } = {},
  ): Promise<T> {
    this.assertOpen();
    const signal = AbortSignal.any([
      this.shutdown.signal,
      ...(options.callerSignal ? [options.callerSignal] : []),
      AbortSignal.timeout(options.deadlineMs ?? this.deadlineMs()),
    ]);
    const task = work(signal);
    this.track(task);
    return task;
  }

  /**
   * Work that must finish even though the lane is closing, such as finishing a
   * receipt that was persisted before its admission was refused. It takes no
   * lane, but `close()` waits for it.
   */
  finish(work: () => Promise<unknown>): Promise<void> {
    const task = (async () => work())().then(
      () => undefined,
      () => undefined,
    );
    this.track(task);
    return task;
  }

  private track(task: Promise<unknown>) {
    const settled = task.then(
      () => undefined,
      () => undefined,
    );
    this.active.add(settled);
    void settled.finally(() => this.active.delete(settled));
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
      // Drain to quiescence rather than awaiting one snapshot: refusing a
      // queued admission registers its owned finalization a microtask later,
      // which a single snapshot would miss.
      this.closing = (async () => {
        while (this.active.size > 0) await Promise.all([...this.active]);
        this.closeResources();
      })();
    }
    return this.closing;
  }
}
