import type {
  ReviewedFileKey,
  ReviewedFileMark,
  ReviewedFileRemoval,
  ReviewedFileSave,
  ReviewedFileStaleness,
  ReviewedScope,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

type Row = {
  worktreeId: string;
  scope?: ReviewedScope | undefined;
  mark: ReviewedFileMark;
};

function rowKey(key: ReviewedFileKey, path: string): string {
  return `${key.worktreeId}\0${key.scope ?? 'worktree'}\0${path}`;
}

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  private readonly rows: Map<string, Row>;
  private readonly staleness = new Map<string, boolean>();

  constructor(rows: readonly Row[] = []) {
    this.rows = new Map(
      rows.map((row) => [
        rowKey(row, row.mark.path),
        { ...row, mark: { ...row.mark } },
      ]),
    );
  }

  list(input: ReviewedFileKey): ReviewedFileMark[] {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.worktreeId === input.worktreeId &&
          (row.scope ?? 'worktree') === (input.scope ?? 'worktree'),
      )
      .map((row) => ({
        ...row.mark,
        stale: this.staleness.get(rowKey(row, row.mark.path)) ?? row.mark.stale,
      }))
      .sort(
        (left, right) =>
          Number(left.path > right.path) - Number(left.path < right.path),
      );
  }

  save(input: ReviewedFileSave): void {
    input.marks.forEach((mark) => {
      this.rows.set(rowKey(input, mark.path), {
        worktreeId: input.worktreeId,
        scope: input.scope,
        mark: { ...mark },
      });
      this.staleness.delete(rowKey(input, mark.path));
    });
  }

  remove(input: ReviewedFileRemoval): void {
    input.paths.forEach((path) => {
      this.rows.delete(rowKey(input, path));
      this.staleness.delete(rowKey(input, path));
    });
  }

  setStale(input: ReviewedFileStaleness): void {
    input.paths.forEach((path) =>
      this.staleness.set(rowKey(input, path), input.stale),
    );
  }
}
