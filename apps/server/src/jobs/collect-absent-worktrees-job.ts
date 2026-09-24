import type { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';

const COLLECTION_INTERVAL_MS = 60 * 60_000;

export class CollectAbsentWorktreesJob {
  private readonly collectAbsentWorktrees: Pick<
    CollectAbsentWorktreesUseCase,
    'execute'
  >;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    collectAbsentWorktrees: Pick<CollectAbsentWorktreesUseCase, 'execute'>,
  ) {
    this.collectAbsentWorktrees = collectAbsentWorktrees;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      this.collectAbsentWorktrees.execute({}).catch(() => undefined);
    }, COLLECTION_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
