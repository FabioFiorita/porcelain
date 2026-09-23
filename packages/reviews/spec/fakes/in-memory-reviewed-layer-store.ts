import type { ReviewedLayerMark } from '../../src/models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

export class InMemoryReviewedLayerStore implements ReviewedLayerStore {
  private readonly marks = new Map<string, Map<string, ReviewedLayerMark>>();

  private of(worktreeId: string): Map<string, ReviewedLayerMark> {
    const existing = this.marks.get(worktreeId);
    if (existing) return existing;
    const created = new Map<string, ReviewedLayerMark>();
    this.marks.set(worktreeId, created);
    return created;
  }

  list(worktreeId: string): ReviewedLayerMark[] {
    return [...this.of(worktreeId).values()].map((mark) => ({ ...mark }));
  }

  save(worktreeId: string, mark: ReviewedLayerMark): void {
    this.of(worktreeId).set(mark.layerId, { ...mark });
  }

  remove(worktreeId: string, layerId: string): void {
    this.of(worktreeId).delete(layerId);
  }

  setStale(
    worktreeId: string,
    layerIds: readonly string[],
    stale: boolean,
  ): void {
    for (const layerId of layerIds) {
      const mark = this.of(worktreeId).get(layerId);
      if (mark) mark.stale = stale;
    }
  }
}
