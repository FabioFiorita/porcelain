import type { ReadOwnerStatusResult } from '../models/read-owner-status.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';

export class ReadOwnerStatusService {
  private readonly runtimeStatusReader: RuntimeStatusReader;

  constructor(runtimeStatusReader: RuntimeStatusReader) {
    this.runtimeStatusReader = runtimeStatusReader;
  }

  execute(): ReadOwnerStatusResult {
    return this.runtimeStatusReader.current();
  }
}
