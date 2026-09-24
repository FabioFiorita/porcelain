import type { ReviewedLayerMark } from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: { worktreeId: string }): ReviewedLayerMark[];
  save(input: { worktreeId: string; mark: ReviewedLayerMark }): void;
  remove(input: { worktreeId: string; layerId: string }): void;
  setStale(input: {
    worktreeId: string;
    layerIds: readonly string[];
    stale: boolean;
  }): void;
}
