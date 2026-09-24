import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  ReviewedLayerMark,
  ReviewedLayerRemoval,
  ReviewedLayerSave,
  ReviewedLayerStaleness,
  WorktreeReviewedLayerMark,
} from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: WorktreeKey): ReviewedLayerMark[];
  byWorktrees(input: WorktreeKeys): WorktreeReviewedLayerMark[];
  save(input: ReviewedLayerSave): void;
  remove(input: ReviewedLayerRemoval): void;
  setStale(input: ReviewedLayerStaleness): void;
}
