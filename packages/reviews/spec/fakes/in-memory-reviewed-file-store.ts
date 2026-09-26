import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  ReviewedFileMark,
  ReviewedFileRemoval,
  ReviewedFileSave,
  ReviewedFileStaleness,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

type Row = { worktreeId: string; mark: ReviewedFileMark };

function rowKey(worktreeId: string, path: string): string {
  return `${worktreeId}\0${path}`;
}

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  private readonly rows: Map<string, Row>;
  private readonly staleness = new Map<string, boolean>();

  constructor(rows: readonly Row[] = []) {
    this.rows = new Map(
      rows.map((row) => [
        rowKey(row.worktreeId, row.mark.path),
        { worktreeId: row.worktreeId, mark: { ...row.mark } },
      ]),
    );
  }

  list(input: WorktreeKey): ReviewedFileMark[] {
    return [...this.rows.values()]
      .filter((row) => row.worktreeId === input.worktreeId)
      .map((row) => ({
        ...row.mark,
        stale:
          this.staleness.get(rowKey(row.worktreeId, row.mark.path)) ??
          row.mark.stale,
      }))
      .sort(
        (left, right) =>
          Number(left.path > right.path) - Number(left.path < right.path),
      );
  }

  save(input: ReviewedFileSave): void {
    input.marks.forEach((mark) => {
      this.rows.set(rowKey(input.worktreeId, mark.path), {
        worktreeId: input.worktreeId,
        mark: { ...mark },
      });
      this.staleness.delete(rowKey(input.worktreeId, mark.path));
    });
  }

  remove(input: ReviewedFileRemoval): void {
    input.paths.forEach((path) => {
      this.rows.delete(rowKey(input.worktreeId, path));
      this.staleness.delete(rowKey(input.worktreeId, path));
    });
  }

  setStale(input: ReviewedFileStaleness): void {
    input.paths.forEach((path) =>
      this.staleness.set(rowKey(input.worktreeId, path), input.stale),
    );
  }
}
