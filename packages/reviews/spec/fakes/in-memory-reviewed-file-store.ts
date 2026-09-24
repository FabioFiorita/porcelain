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
      .map((row) => ({ ...row.mark }))
      .sort(
        (left, right) =>
          Number(left.path > right.path) - Number(left.path < right.path),
      );
  }

  save(input: ReviewedFileSave): void {
    input.marks.forEach((mark) =>
      this.rows.set(rowKey(input.worktreeId, mark.path), {
        worktreeId: input.worktreeId,
        mark: { ...mark },
      }),
    );
  }

  remove(input: ReviewedFileRemoval): void {
    input.paths.forEach((path) =>
      this.rows.delete(rowKey(input.worktreeId, path)),
    );
  }

  setStale(input: ReviewedFileStaleness): void {
    input.paths
      .map((path) => this.rows.get(rowKey(input.worktreeId, path)))
      .filter((row) => row !== undefined)
      .forEach((row) =>
        this.rows.set(rowKey(row.worktreeId, row.mark.path), {
          worktreeId: row.worktreeId,
          mark: { ...row.mark, stale: input.stale },
        }),
      );
  }
}
