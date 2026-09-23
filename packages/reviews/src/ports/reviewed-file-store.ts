import type { ReviewedFileMark } from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(worktreeId: string): ReviewedFileMark[];
  find(worktreeId: string, path: string): ReviewedFileMark | undefined;
  count(worktreeId: string): number;
  oldest(worktreeId: string, limit: number): string[];
  save(worktreeId: string, mark: ReviewedFileMark): void;
  remove(worktreeId: string, paths: readonly string[]): void;
  setStale(worktreeId: string, paths: readonly string[], stale: boolean): void;
}
