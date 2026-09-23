import type { GitStatusObservation } from '../status.ts';

export interface StatusReader {
  readStatus(signal?: AbortSignal): Promise<GitStatusObservation>;
}
