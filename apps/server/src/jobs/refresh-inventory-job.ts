import type { Logger } from '../ports/logger.ts';
import type { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import type { Job, JobOptions } from './job.ts';

export class RefreshInventoryJob implements Job {
  private readonly refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>;
  private readonly logger: Logger;
  private readonly options: JobOptions;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  private stopped = new AbortController();

  constructor(
    refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>,
    logger: Logger,
    options: JobOptions,
  ) {
    this.refreshInventory = refreshInventory;
    this.logger = logger;
    this.options = options;
  }

  start(): void {
    clearInterval(this.timer);
    this.stopped = new AbortController();
    this.timer = setInterval(() => this.refresh(), this.options.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    this.stopped.abort();
    await this.running;
  }

  private refresh(): void {
    if (this.running !== undefined) return;
    this.running = this.refreshInventory
      .execute({ signal: this.stopped.signal })
      .catch((error: unknown) => this.reportFailure(error))
      .finally(() => {
        this.running = undefined;
      });
  }

  private reportFailure(error: unknown): void {
    if (!this.stopped.signal.aborted)
      this.logger.failure({ kind: 'job', job: 'refresh-inventory', error });
  }
}
