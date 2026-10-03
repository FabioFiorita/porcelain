import type { OwnerStatus } from '@porcelain/kernel/models';

export interface RuntimeStatusReader {
  current(): OwnerStatus;
}
