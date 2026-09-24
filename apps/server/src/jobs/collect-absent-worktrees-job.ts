import type { Logger } from '../ports/logger.ts';
import type { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';
import type { Job, JobOptions } from './job.ts';

export class CollectAbsentWorktreesJob implements Job {
  private readonly collectAbsentWorktrees: Pick<
    CollectAbsentWorktreesUseCase,
    'execute'
  >;
  private readonly logger: Logger;
  private readonly options: JobOptions;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    collectAbsentWorktrees: Pick<CollectAbsentWorktreesUseCase, 'execute'>,
    logger: Logger,
    options: JobOptions,
  ) {
    this.collectAbsentWorktrees = collectAbsentWorktrees;
    this.logger = logger;
    this.options = options;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.collect(), this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private collect(): void {
    this.collectAbsentWorktrees.execute({}).catch((error: unknown) =>
      this.logger.failure({
        kind: 'job',
        job: 'collect-absent-worktrees',
        error,
      }),
    );
  }
}
