import type { RuntimeStatus } from '@porcelain/access/models';
import type { RuntimeStatusReader } from '@porcelain/access/ports';

export class RuntimeStatusReaderAdapter implements RuntimeStatusReader {
  private readonly status: () => RuntimeStatus;

  constructor(status: () => RuntimeStatus) {
    this.status = status;
  }

  current(): RuntimeStatus {
    return this.status();
  }
}
