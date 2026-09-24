import type { EventPublisher } from '../ports/event-publisher.ts';
import type { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import type { Job, JobOptions } from './job.ts';

export class FlushDeviceActivityJob implements Job {
  private readonly flushDeviceActivity: Pick<
    FlushDeviceActivityUseCase,
    'execute'
  >;
  private readonly events: EventPublisher;
  private readonly options: JobOptions;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    flushDeviceActivity: Pick<FlushDeviceActivityUseCase, 'execute'>,
    events: EventPublisher,
    options: JobOptions,
  ) {
    this.flushDeviceActivity = flushDeviceActivity;
    this.events = events;
    this.options = options;
  }

  start(): void {
    clearInterval(this.timer);
    this.timer = setInterval(
      () => this.flushInBackground(),
      this.options.intervalMs,
    );
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
    await this.flush();
  }

  private flushInBackground(): void {
    this.flush().catch(() => undefined);
  }

  private flush(): Promise<void> {
    return this.flushDeviceActivity
      .execute({})
      .catch((error: unknown) =>
        this.events.jobFailed('flush-device-activity', error),
      );
  }
}
