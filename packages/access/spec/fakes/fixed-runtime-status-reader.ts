import type { OwnerStatus } from '@porcelain/kernel/models';
import type { RuntimeStatusReader } from '../../src/ports/runtime-status-reader.ts';

export class FixedRuntimeStatusReader implements RuntimeStatusReader {
  private readonly status: OwnerStatus;

  constructor(status: OwnerStatus) {
    this.status = status;
  }

  current(): OwnerStatus {
    return this.status;
  }
}
