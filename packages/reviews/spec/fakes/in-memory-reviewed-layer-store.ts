import type {
  ReviewedLayerMark,
  WorktreeReviewedLayerMark,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

type Row = { worktreeId: string; mark: ReviewedLayerMark };

export class InMemoryReviewedLayerStore implements ReviewedLayerStore {
  private rows: Row[] = [];

  list(input: { worktreeId: string }): ReviewedLayerMark[] {
    return this.rows
      .filter((row) => row.worktreeId === input.worktreeId)
      .map((row) => ({ ...row.mark }));
  }

  byWorktrees(input: {
    worktreeIds: readonly string[];
  }): WorktreeReviewedLayerMark[] {
    return this.rows
      .filter((row) => input.worktreeIds.includes(row.worktreeId))
      .map((row) => ({ worktreeId: row.worktreeId, ...row.mark }));
  }

  save(input: { worktreeId: string; mark: ReviewedLayerMark }): void {
    this.remove({ worktreeId: input.worktreeId, layerId: input.mark.layerId });
    this.rows = [
      ...this.rows,
      { worktreeId: input.worktreeId, mark: { ...input.mark } },
    ];
  }

  remove(input: { worktreeId: string; layerId: string }): void {
    this.rows = this.rows.filter(
      (row) =>
        row.worktreeId !== input.worktreeId ||
        row.mark.layerId !== input.layerId,
    );
  }

  setStale(input: {
    worktreeId: string;
    layerIds: readonly string[];
    stale: boolean;
  }): void {
    this.rows = this.rows.map((row) =>
      row.worktreeId === input.worktreeId &&
      input.layerIds.includes(row.mark.layerId)
        ? { ...row, mark: { ...row.mark, stale: input.stale } }
        : row,
    );
  }
}
