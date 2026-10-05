import { Effect } from 'effect';
import type { ReadOwnerStatusResult } from '../models/read-owner-status.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';

export class ReadOwnerStatusService {
  private readonly runtimeStatusReader: RuntimeStatusReader;

  constructor(runtimeStatusReader: RuntimeStatusReader) {
    this.runtimeStatusReader = runtimeStatusReader;
  }

  execute(): Effect.Effect<ReadOwnerStatusResult, never> {
    return Effect.sync(() => {
      return this.runtimeStatusReader.current();
    });
  }
}
