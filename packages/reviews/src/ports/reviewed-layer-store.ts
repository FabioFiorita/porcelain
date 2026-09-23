import type { ReviewedLayerMark } from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(worktreeId: string): ReviewedLayerMark[];
  save(worktreeId: string, mark: ReviewedLayerMark): void;
  remove(worktreeId: string, layerId: string): void;
  setStale(
    worktreeId: string,
    layerIds: readonly string[],
    stale: boolean,
  ): void;
}
