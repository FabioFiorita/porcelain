import type { ReviewedMark } from '../../models/reviewed-file.ts';

export interface ReviewedFileStore {
  list(worktreeId: string): ReviewedMark[];
  set(
    worktreeId: string,
    path: string,
    fingerprint: string,
    reviewedAt: string,
  ): ReviewedMark;
  remove(worktreeId: string, path: string): void;
}
