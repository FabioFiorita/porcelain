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
    this.stop();
    this.timer = setInterval(() => this.flush(), this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.flush();
  }

  private flush(): void {
    this.flushDeviceActivity
      .execute({})
      .catch((error: unknown) =>
        this.events.jobFailed('flush-device-activity', error),
      );
  }
}
