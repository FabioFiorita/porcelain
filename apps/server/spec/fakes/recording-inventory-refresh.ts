import type { JobWork } from '../../src/runtime/interval-job.ts';

export class RecordingInventoryRefresh implements JobWork {
  private fresh = false;

  async execute(): Promise<void> {
    this.fresh = true;
  }

  isFresh(): boolean {
    return this.fresh;
  }
}
