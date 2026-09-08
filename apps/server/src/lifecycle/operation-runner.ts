import { ApplicationClosedError } from './errors/application-closed-error.ts';

export class OperationRunner {
  private readonly shutdown = new AbortController();
  private readonly closeResources: () => void;
  private readonly timeoutMs: number;
  private pending: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;

  constructor(closeResources: () => void, timeoutMs: number) {
    this.closeResources = closeResources;
    this.timeoutMs = timeoutMs;
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
    const task = this.pending.then(() => {
      signal.throwIfAborted();
      return operation(signal);
    });
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
    const task = this.pending.then(() => operation(signal));
    this.pending = task.catch(() => undefined);
    return task;
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
