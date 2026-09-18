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

export class OperationRunner {
  private readonly shutdown = new AbortController();
  private readonly closeResources: () => void;
  private readonly timeoutMs: number;
  private readonly name: string;
  private pending: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;

  constructor(closeResources: () => void, timeoutMs: number, name = 'unnamed') {
    this.closeResources = closeResources;
    this.timeoutMs = timeoutMs;
    this.name = name;
  }

  assertOpen(): void {
    if (this.shutdown.signal.aborted) throw new ApplicationClosedError();
  }

  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    if (this.shutdown.signal.aborted)
      return Promise.reject(new ApplicationClosedError());
    const signal = AbortSignal.any([
      this.shutdown.signal,
      AbortSignal.timeout(this.timeoutMs),
      ...(callerSignal ? [callerSignal] : []),
    ]);
    const id = ++sequence;
    this.publish(id, 'queued');
    const task = this.pending.then(() => {
      signal.throwIfAborted();
      this.publish(id, 'started');
      return operation(signal);
    });
    this.publishSettled(task, id);
    this.pending = task.catch(() => undefined);
    return new Promise<T>((resolve, reject) => {
      const cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      task
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', cancel));
      if (signal.aborted) cancel();
    });
  }

  // The write callback owns receipt finalization, even when aborted while queued.
  // Unlike run(), its promise settles only after cleanup and persistence unwind.
  runOwned<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    callerSignal?: AbortSignal,
  ): Promise<T> {
    this.assertOpen();
    const signal = AbortSignal.any([
      this.shutdown.signal,
      AbortSignal.timeout(timeoutMs),
      ...(callerSignal ? [callerSignal] : []),
    ]);
    const id = ++sequence;
    this.publish(id, 'queued');
    const task = this.pending.then(() => {
      this.publish(id, 'started');
      return operation(signal);
    });
    this.publishSettled(task, id);
    this.pending = task.catch(() => undefined);
    return task;
  }

  private publish(
    operation: number,
    phase: OperationEvent['phase'],
    failed?: boolean,
  ) {
    if (!operationChannel.hasSubscribers) return;
    const event: OperationEvent = { runner: this.name, operation, phase };
    if (failed !== undefined) event.failed = failed;
    operationChannel.publish(event);
  }

  private publishSettled(task: Promise<unknown>, operation: number) {
    if (!operationChannel.hasSubscribers) return;
    task.then(
      () => this.publish(operation, 'settled', false),
      () => this.publish(operation, 'settled', true),
    );
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.closing = this.pending.then(() => {
        this.closeResources();
      });
      this.shutdown.abort(new ApplicationClosedError());
    }
    return this.closing;
  }
}
