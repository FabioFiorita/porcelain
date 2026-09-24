import { channel } from 'node:diagnostics_channel';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { ApplicationClosedError } from './errors/application-closed-error.ts';

const operationChannel = channel('porcelain:operation');

export type OperationEvent = {
  runner: string;
  operation: number;
  phase: 'queued' | 'started' | 'settled';
  failed?: boolean;
};

let sequence = 0;

export type LaneMode = 'read' | 'write';

export type Admission = {
  readonly lane: string;
  readonly mode: LaneMode;
  readonly signal: AbortSignal;
};

type Waiter = {
  admit: () => void;
  refuse: (reason: unknown) => void;
  detach: () => void;
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
  readCapacity: number;
  deadlineMs: number | (() => number);
  consistency: WorktreeConsistencyProbe;
  closeResources?: () => void;
};

export type RunOptions = {
  callerSignal?: AbortSignal | undefined;
  deadlineMs?: number | undefined;
  untilSettled?: boolean | undefined;
};

export class Lanes {
  private readonly gates = new Map<string, Gate>();
  private readonly capacity: number;
  private readonly deadlineMs: () => number;
  private readonly closeResources: () => void;
  private readonly consistency: WorktreeConsistencyProbe;
  private readonly shutdown = new AbortController();
  private active = new Set<Promise<unknown>>();
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

  async run<T>(
    lane: string,
    mode: LaneMode,
    work: (admission: Admission) => Promise<T>,
    options: RunOptions = {},
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
    const signal = AbortSignal.any([
      waiting,
      AbortSignal.timeout(options.deadlineMs ?? this.deadlineMs()),
    ]);
    this.publish(id, lane, 'started');
    let task: Promise<T>;
    try {
      task = Promise.resolve(work({ lane, mode, signal }));
    } catch (cause) {
      gate.leave(mode);
      if (gate.idle) this.gates.delete(lane);
      this.publish(id, lane, 'settled', true);
      throw cause;
    }
    this.track(task);
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

  runConsistent<T>(
    lane: string,
    worktree: ListedWorktree,
    work: (admission: Admission) => Promise<T>,
    options: RunOptions = {},
  ): Promise<T> {
    return this.run(
      lane,
      'read',
      async (admission) => {
        const result = await work(admission);
        this.consistency.execute({ worktree });
        return result;
      },
      options,
    );
  }

  background(
    lane: string,
    work: (admission: Admission) => Promise<void>,
    options: {
      deadlineMs?: number | undefined;
      onFailure: (error: unknown) => unknown;
    },
  ): void {
    this.track(
      this.run(lane, 'write', work, {
        deadlineMs: options.deadlineMs,
        untilSettled: true,
      }).catch((error: unknown) => options.onFailure(error)),
    );
  }

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

  finish(
    work: () => Promise<unknown>,
    options: { lane: string },
  ): Promise<void> {
    const task = this.admitWhileClosing(options.lane, work).then(
      () => undefined,
      () => undefined,
    );
    this.track(task);
    return task;
  }

  private async admitWhileClosing(lane: string, work: () => Promise<unknown>) {
    const gate = this.gate(lane);
    await gate.enter('write');
    try {
      return await work();
    } finally {
      gate.leave('write');
      if (gate.idle) this.gates.delete(lane);
    }
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
      this.closing = (async () => {
        while (this.active.size > 0) await Promise.all([...this.active]);
        this.closeResources();
      })();
    }
    return this.closing;
  }
}
