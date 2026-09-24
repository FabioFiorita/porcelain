import type { GitStatusObservation } from '../dtos/git-status.ts';

export type StatusReader = {
  readStatus(signal?: AbortSignal): Promise<GitStatusObservation>;
};
