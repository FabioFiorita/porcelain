import { Context } from 'effect';
import type { OwnerStatus } from '@porcelain/kernel/models';

export interface RuntimeStatusReader {
  current(): OwnerStatus;
}

export const RuntimeStatusReader = Context.Service<
  '@porcelain/access/RuntimeStatusReader',
  RuntimeStatusReader
>('@porcelain/access/RuntimeStatusReader');
