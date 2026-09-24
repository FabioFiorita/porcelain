import type { ReviewedFileMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

type Row = { worktreeId: string; mark: ReviewedFileMark };

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  private rows: Row[] = [];

  list(input: { worktreeId: string }): ReviewedFileMark[] {
    return this.rows
      .filter((row) => row.worktreeId === input.worktreeId)
      .map((row) => ({ ...row.mark }))
      .sort((left, right) => (left.path < right.path ? -1 : 1));
  }

  save(input: {
    worktreeId: string;
    marks: readonly ReviewedFileMark[];
  }): void {
    const saved = new Set(input.marks.map((mark) => mark.path));
    this.rows = [
      ...this.rows.filter(
        (row) =>
          row.worktreeId !== input.worktreeId || !saved.has(row.mark.path),
      ),
      ...input.marks.map((mark) => ({
        worktreeId: input.worktreeId,
        mark: { ...mark },
      })),
    ];
  }

  remove(input: { worktreeId: string; paths: readonly string[] }): void {
    this.rows = this.rows.filter(
      (row) =>
        row.worktreeId !== input.worktreeId ||
        !input.paths.includes(row.mark.path),
    );
  }

  setStale(input: {
    worktreeId: string;
    paths: readonly string[];
    stale: boolean;
  }): void {
    this.rows = this.rows.map((row) =>
      row.worktreeId === input.worktreeId && input.paths.includes(row.mark.path)
        ? { ...row, mark: { ...row.mark, stale: input.stale } }
        : row,
    );
  }
}
