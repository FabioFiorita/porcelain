import type { ReadChangesResult } from '../models/review-evidence.ts';

export interface WorktreeChangeReader {
  read(worktreeId: string, signal?: AbortSignal): Promise<ReadChangesResult>;
}
