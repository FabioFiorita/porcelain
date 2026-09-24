import type { EventPublisher } from '../ports/event-publisher.ts';
import type { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';
import type { Job, JobOptions } from './job.ts';

export class CollectAbsentWorktreesJob implements Job {
  private readonly collectAbsentWorktrees: Pick<
    CollectAbsentWorktreesUseCase,
    'execute'
  >;
  private readonly events: EventPublisher;
  private readonly options: JobOptions;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    collectAbsentWorktrees: Pick<CollectAbsentWorktreesUseCase, 'execute'>,
    events: EventPublisher,
    options: JobOptions,
  ) {
    this.collectAbsentWorktrees = collectAbsentWorktrees;
    this.events = events;
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
    this.collectAbsentWorktrees
      .execute({})
      .catch((error: unknown) =>
        this.events.jobFailed('collect-absent-worktrees', error),
      );
  }
}
