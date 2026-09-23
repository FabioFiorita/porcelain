import type { GitStatusObservation } from '../inspection/status.ts';

export interface StatusReader {
  readStatus(signal?: AbortSignal): Promise<GitStatusObservation>;
}
