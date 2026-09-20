/**
 * How many Git processes a listing may have running at once, across everyone.
 *
 * This sits at the launch itself rather than around the callers waiting for
 * one, because those are not the same number: a caller that gives up on a
 * shared read releases its place while the process it started keeps running,
 * and a worktree id that misses the directory lists projects from outside the
 * inventory lane entirely. Counting permits here is the only place that bounds
 * processes.
 *
 * It is deliberately not a lane: nothing here waits on a repository, so it can
 * neither be re-entered nor deadlock against one.
 */
export class LaunchLimit {
  private readonly capacity: number;
  private running = 0;
  private readonly waiting: { admit: () => void }[] = [];

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** How many launches are in flight; for tests and tooling. */
  get inFlight() {
    return this.running;
  }

  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.admit(signal);
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  private admit(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.running < this.capacity) {
      this.running += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        admit: () => {
          signal?.removeEventListener('abort', leave);
          resolve();
        },
      };
      // A caller that leaves while queued must not hold a place, or a slow
      // repository would keep a permit reserved for someone who has gone.
      const leave = () => {
        const index = this.waiting.indexOf(waiter);
        if (index >= 0) this.waiting.splice(index, 1);
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', leave, { once: true });
      this.waiting.push(waiter);
    });
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next.admit();
    else this.running -= 1;
  }
}
