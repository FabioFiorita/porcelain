import type { FlushDeviceActivityController } from '../controllers/flush-device-activity-controller.ts';

const FLUSH_INTERVAL_MS = 60_000;

export class FlushDeviceActivityJob {
  private readonly controller: Pick<FlushDeviceActivityController, 'execute'>;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(controller: Pick<FlushDeviceActivityController, 'execute'>) {
    this.controller = controller;
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
    this.controller.execute({}).catch(() => undefined);
  }
}
