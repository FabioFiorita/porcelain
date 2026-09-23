import type { RuntimeStatus } from '../models/runtime-status.ts';

export interface RuntimeStatusReader {
  current(): RuntimeStatus;
}
