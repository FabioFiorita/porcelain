import type {
  ReviewedLayerMark,
  WorktreeReviewedLayerMark,
} from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: { worktreeId: string }): ReviewedLayerMark[];
  byWorktrees(input: {
    worktreeIds: readonly string[];
  }): WorktreeReviewedLayerMark[];
  save(input: { worktreeId: string; mark: ReviewedLayerMark }): void;
  remove(input: { worktreeId: string; layerId: string }): void;
  setStale(input: {
    worktreeId: string;
    layerIds: readonly string[];
    stale: boolean;
  }): void;
}
