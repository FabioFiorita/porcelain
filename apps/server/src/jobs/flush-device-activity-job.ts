import type { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';

const FLUSH_INTERVAL_MS = 60_000;

export class FlushDeviceActivityJob {
  private readonly flushDeviceActivity: Pick<
    FlushDeviceActivityUseCase,
    'execute'
  >;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    flushDeviceActivity: Pick<FlushDeviceActivityUseCase, 'execute'>,
  ) {
    this.flushDeviceActivity = flushDeviceActivity;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.flush();
  }

  private flush(): void {
    this.flushDeviceActivity.execute({}).catch(() => undefined);
  }
}
