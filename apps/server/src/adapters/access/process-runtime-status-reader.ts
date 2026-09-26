import type { OwnerStatus } from '@porcelain/kernel/models';
import type { RuntimeStatusReader } from '@porcelain/access/ports';

export class ProcessRuntimeStatusReader implements RuntimeStatusReader {
  private readonly status: () => OwnerStatus;

  constructor(status: () => OwnerStatus) {
    this.status = status;
  }

  current(): OwnerStatus {
    return this.status();
  }
}
