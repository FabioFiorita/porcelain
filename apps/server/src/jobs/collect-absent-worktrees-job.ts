import type { CollectAbsentWorktreesController } from '../controllers/collect-absent-worktrees-controller.ts';

const COLLECTION_INTERVAL_MS = 60 * 60_000;

export class CollectAbsentWorktreesJob {
  private readonly controller: Pick<
    CollectAbsentWorktreesController,
    'execute'
  >;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(controller: Pick<CollectAbsentWorktreesController, 'execute'>) {
    this.controller = controller;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      this.controller.execute({}, {}).catch(() => undefined);
    }, COLLECTION_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
