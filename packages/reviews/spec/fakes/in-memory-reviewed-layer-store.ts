import { Effect } from 'effect';
import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  ReviewedLayerMark,
  ReviewedLayerRemoval,
  ReviewedLayerSave,
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

  list(input: WorktreeKey): Effect.Effect<ReviewedLayerMark[]> {
    return Effect.sync(() => {
      return this.stored()
        .filter((row) => row.worktreeId === input.worktreeId)
        .map((row) => ({
          layerId: row.layerId,
          fingerprint: row.fingerprint,
          reviewedAt: row.reviewedAt,
        }))
        .sort(
          (left, right) =>
            left.reviewedAt.localeCompare(right.reviewedAt) ||
            left.layerId.localeCompare(right.layerId),
        );
    });
  }

  byWorktrees(input: WorktreeKeys): Effect.Effect<WorktreeReviewedLayerMark[]> {
    return Effect.sync(() => {
      return this.stored().filter((row) =>
        input.worktreeIds.includes(row.worktreeId),
      );
    });
  }

  save(input: ReviewedLayerSave): Effect.Effect<void> {
    return Effect.sync(() => {
      input.marks.forEach((mark) => {
        this.rows.set(rowKey(input.worktreeId, mark.layerId), {
          worktreeId: input.worktreeId,
          ...mark,
        });
      });
    });
  }

  remove(input: ReviewedLayerRemoval): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows.delete(rowKey(input.worktreeId, input.layerId));
    });
  }

  private stored(): WorktreeReviewedLayerMark[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }
}
