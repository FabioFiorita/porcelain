import type { ReviewedFileMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedFileStore } from '../../src/ports/reviewed-file-store.ts';

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  private readonly marks = new Map<string, Map<string, ReviewedFileMark>>();

  private of(worktreeId: string): Map<string, ReviewedFileMark> {
    const existing = this.marks.get(worktreeId);
    if (existing) return existing;
    const created = new Map<string, ReviewedFileMark>();
    this.marks.set(worktreeId, created);
    return created;
  }

  list(worktreeId: string): ReviewedFileMark[] {
    return [...this.of(worktreeId).values()]
      .map((mark) => ({ ...mark }))
      .sort((left, right) => (left.path < right.path ? -1 : 1));
  }

  find(worktreeId: string, path: string): ReviewedFileMark | undefined {
    const mark = this.of(worktreeId).get(path);
    return mark ? { ...mark } : undefined;
  }

  count(worktreeId: string): number {
    return this.of(worktreeId).size;
  }

  oldest(worktreeId: string, limit: number): string[] {
    return [...this.of(worktreeId).values()]
      .sort(
        (left, right) =>
          left.reviewedAt.localeCompare(right.reviewedAt) ||
          (left.path < right.path ? -1 : 1),
      )
      .slice(0, limit)
      .map((mark) => mark.path);
  }

  save(worktreeId: string, mark: ReviewedFileMark): void {
    this.of(worktreeId).set(mark.path, { ...mark });
  }

  remove(worktreeId: string, paths: readonly string[]): void {
    for (const path of paths) this.of(worktreeId).delete(path);
  }

  setStale(worktreeId: string, paths: readonly string[], stale: boolean): void {
    for (const path of paths) {
      const mark = this.of(worktreeId).get(path);
      if (mark) mark.stale = stale;
    }
  }
}
