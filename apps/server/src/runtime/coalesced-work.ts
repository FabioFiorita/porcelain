import type { JobWork } from '../ports/job-work.ts';
import type { OperationContext } from '../ports/operation-context.ts';

function ignore(): void {}

export class CoalescedWork implements JobWork {
  private readonly work: JobWork;
  private running: Promise<void> | undefined;
  private following: Promise<void> | undefined;

  constructor(work: JobWork) {
    this.work = work;
  }

  execute(context: OperationContext): Promise<void> {
    const run = this.join();
    const { signal } = context;
    if (!signal) return run;
    return new Promise<void>((resolve, reject) => {
      const leave = () => reject(signal.reason);
      if (signal.aborted) return leave();
      signal.addEventListener('abort', leave, { once: true });
      run
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', leave));
    });
  }

  private join(): Promise<void> {
    if (this.following) return this.following;
    if (!this.running) return this.start();
    const following = this.running.then(ignore, ignore).then(() => {
      this.following = undefined;
      return this.start();
    });
    this.following = following;
    return following;
  }

  private start(): Promise<void> {
    const run: Promise<void> = this.work.execute({}).finally(() => {
      if (this.running === run) this.running = undefined;
    });
    this.running = run;
    return run;
  }
}
