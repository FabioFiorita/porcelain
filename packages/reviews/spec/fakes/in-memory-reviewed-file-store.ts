import { Effect } from 'effect';
import type {
  ReviewedFileKey,
  ReviewedFileMark,
  ReviewedFileRemoval,
  ReviewedFileSave,
  ReviewedFileStaleness,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

type Row = ReviewedFileKey & { mark: ReviewedFileMark };
function rowKey(
  key: ReviewedFileKey,
  path: string,
  fingerprint?: string,
): string {
  return `${key.reviewId ?? key.worktreeId}\0${key.scope ?? 'worktree'}\0${key.branch ?? ''}\0${path}${(key.reviewId && `\0${fingerprint ?? ''}`) || ''}`;
}

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  private readonly rows: Map<string, Row>;
  private readonly staleness = new Map<string, boolean>();

  constructor(rows: readonly Row[] = []) {
    this.rows = new Map(
      rows.map((row) => [
        rowKey(row, row.mark.path, row.mark.fingerprint),
        { ...row, mark: { ...row.mark } },
      ]),
    );
  }

  list(input: ReviewedFileKey): Effect.Effect<ReviewedFileMark[]> {
    return Effect.sync(() => {
      return [...this.rows.values()]
        .filter(
          (row) =>
            row.worktreeId === input.worktreeId &&
            row.reviewId === input.reviewId &&
            (row.scope ?? 'worktree') === (input.scope ?? 'worktree') &&
            (row.branch ?? '') === (input.branch ?? ''),
        )
        .map((row) => ({
          ...row.mark,
          stale:
            this.staleness.get(
              rowKey(row, row.mark.path, row.mark.fingerprint),
            ) ?? row.mark.stale,
        }))
        .sort(
          (left, right) =>
            Number(left.path > right.path) - Number(left.path < right.path),
        );
    });
  }

  save(input: ReviewedFileSave): Effect.Effect<void> {
    return Effect.sync(() => {
      input.marks.forEach((mark) => {
        this.rows.set(rowKey(input, mark.path, mark.fingerprint), {
          ...input,
          scope: input.scope,
          branch: input.branch,
          mark: { ...mark },
        });
        this.staleness.delete(rowKey(input, mark.path, mark.fingerprint));
      });
    });
  }

  remove(input: ReviewedFileRemoval): Effect.Effect<void> {
    return Effect.sync(() => {
      input.paths.forEach((path) => {
        const key = rowKey(input, path, input.fingerprint);
        this.rows.delete(key);
        this.staleness.delete(key);
      });
    });
  }

  setStale(input: ReviewedFileStaleness): Effect.Effect<void> {
    return Effect.sync(() => {
      input.paths.forEach((path) =>
        this.staleness.set(rowKey(input, path), input.stale),
      );
    });
  }
}
