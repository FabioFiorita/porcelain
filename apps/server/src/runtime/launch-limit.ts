export class LaunchLimit {
  private readonly capacity: number;
  private running = 0;
  private readonly waiting: { admit: () => void }[] = [];

  constructor(capacity: number) {
    this.capacity = capacity;
  }

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
