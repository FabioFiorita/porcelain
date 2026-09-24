import type { GitStatusObservation } from '../dtos/git-status.ts';

export interface StatusReader {
  readStatus(signal?: AbortSignal): Promise<GitStatusObservation>;
}
