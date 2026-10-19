import { Effect } from 'effect';
import type {
  ReviewedLayerMark,
  ReviewedLayerSave,
  ReviewedLayerRemoval,
} from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

type Row = ReviewedLayerMark & { reviewId: string };
function rowKey(reviewId: string, layerId: string, fingerprint: string) {
  return `${reviewId}\0${layerId}\0${fingerprint}`;
}
export class InMemoryReviewedLayerStore implements ReviewedLayerStore {
  private readonly rows: Map<string, Row>;
  constructor(rows: readonly Row[] = []) {
    this.rows = new Map(
      rows.map((row) => [
        rowKey(row.reviewId, row.layerId, row.fingerprint),
        { ...row },
      ]),
    );
  }
  list(input: { reviewId: string }): Effect.Effect<ReviewedLayerMark[]> {
    return Effect.sync(() =>
      [...this.rows.values()]
        .filter((row) => row.reviewId === input.reviewId)
        .map(({ reviewId: _, ...mark }) => ({ ...mark })),
    );
  }
  save(input: ReviewedLayerSave): Effect.Effect<void> {
    return Effect.sync(() => {
      input.marks.forEach((mark) =>
        this.rows.set(rowKey(input.reviewId, mark.layerId, mark.fingerprint), {
          reviewId: input.reviewId,
          ...mark,
        }),
      );
    });
  }
  remove(input: ReviewedLayerRemoval): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows.delete(
        rowKey(input.reviewId, input.layerId, input.fingerprint),
      );
    });
  }
}
