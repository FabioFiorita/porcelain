import type { ReviewedLayerMark } from '../models/reviewed-layer.ts';

export interface ReviewedLayerStore {
  list(worktreeId: string): ReviewedLayerMark[];
  set(worktreeId: string, mark: Omit<ReviewedLayerMark, 'stale'>): void;
  invalidate(worktreeId: string, paths?: readonly string[]): void;
  remove(worktreeId: string, layerId: string): void;
}
