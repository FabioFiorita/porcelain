import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  ReviewedLayerMark,
  ReviewedLayerRemoval,
  ReviewedLayerSave,
  ReviewedLayerStaleness,
  WorktreeReviewedLayerMark,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

function rowKey(worktreeId: string, layerId: string): string {
  return `${worktreeId}\0${layerId}`;
}

export class InMemoryReviewedLayerStore implements ReviewedLayerStore {
  private readonly rows: Map<string, WorktreeReviewedLayerMark>;

  constructor(rows: readonly WorktreeReviewedLayerMark[] = []) {
    this.rows = new Map(
      rows.map((row) => [rowKey(row.worktreeId, row.layerId), { ...row }]),
    );
  }

  list(input: WorktreeKey): ReviewedLayerMark[] {
    return [...this.rows.values()]
      .filter((row) => row.worktreeId === input.worktreeId)
      .map((row) => ({
        layerId: row.layerId,
        fingerprint: row.fingerprint,
        reviewedAt: row.reviewedAt,
        stale: row.stale,
      }))
      .sort(
        (left, right) =>
          left.reviewedAt.localeCompare(right.reviewedAt) ||
          left.layerId.localeCompare(right.layerId),
      );
  }

  byWorktrees(input: WorktreeKeys): WorktreeReviewedLayerMark[] {
    return [...this.rows.values()]
      .filter((row) => input.worktreeIds.includes(row.worktreeId))
      .map((row) => ({ ...row }));
  }

  save(input: ReviewedLayerSave): void {
    input.marks.forEach((mark) =>
      this.rows.set(rowKey(input.worktreeId, mark.layerId), {
        worktreeId: input.worktreeId,
        ...mark,
      }),
    );
  }

  remove(input: ReviewedLayerRemoval): void {
    this.rows.delete(rowKey(input.worktreeId, input.layerId));
  }

  setStale(input: ReviewedLayerStaleness): void {
    input.layerIds
      .map((layerId) => this.rows.get(rowKey(input.worktreeId, layerId)))
      .filter((row) => row !== undefined)
      .forEach((row) =>
        this.rows.set(rowKey(row.worktreeId, row.layerId), {
          ...row,
          stale: input.stale,
        }),
      );
  }
}
