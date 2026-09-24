import type { Logger } from '../ports/logger.ts';
import type { JobWork } from '../ports/job-work.ts';
import type { Job } from '../ports/job.ts';
import type { OperationContext } from '../ports/operation-context.ts';

export type JobSchedule = {
  everyMs?: number | undefined;
  atStart?: boolean | undefined;
  atStop?: boolean | undefined;
};

export class JobSequence implements JobWork {
  private readonly works: readonly JobWork[];

  constructor(works: readonly JobWork[]) {
    this.works = works;
  }

  async execute(context: OperationContext): Promise<void> {
    for (const work of this.works) await work.execute(context);
  }
}

export class IntervalJob implements Job {
  private readonly name: string;
  private readonly work: JobWork;
  private readonly schedule: JobSchedule;
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = new AbortController();
  private started = false;

  constructor(
    name: string,
    work: JobWork,
    schedule: JobSchedule,
    logger: Logger,
  ) {
    this.name = name;
    this.work = work;
    this.schedule = schedule;
    this.logger = logger;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopped = new AbortController();
    if (this.schedule.atStart) this.tick();
    if (this.schedule.everyMs === undefined) return;
    this.timer = setInterval(() => this.tick(), this.schedule.everyMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    clearInterval(this.timer);
    this.timer = undefined;
    this.stopped.abort();
    await this.running;
    if (this.schedule.atStop) await this.attempt(new AbortController().signal);
  }

  private tick(): void {
    if (this.running !== undefined) return;
    this.running = this.attempt(this.stopped.signal).finally(() => {
      this.running = undefined;
    });
  }

  private async attempt(signal: AbortSignal): Promise<void> {
    try {
      await this.work.execute({ signal });
    } catch (error) {
      if (!signal.aborted)
        this.logger.failure({ kind: 'job', job: this.name, error });
    }
  }
}
