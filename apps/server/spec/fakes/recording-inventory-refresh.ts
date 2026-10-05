import { Effect } from 'effect';
import type { JobRunner } from '../../src/ports/job-runner.ts';

export class RecordingInventoryRefresh implements JobRunner {
  private fresh = false;

  execute(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.fresh = true;
    });
  }

  isFresh(): boolean {
    return this.fresh;
  }
}
