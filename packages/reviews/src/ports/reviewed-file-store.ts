import type { ReviewedFileMark } from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(input: { worktreeId: string }): ReviewedFileMark[];
  save(input: { worktreeId: string; marks: readonly ReviewedFileMark[] }): void;
  remove(input: { worktreeId: string; paths: readonly string[] }): void;
  setStale(input: {
    worktreeId: string;
    paths: readonly string[];
    stale: boolean;
  }): void;
}
