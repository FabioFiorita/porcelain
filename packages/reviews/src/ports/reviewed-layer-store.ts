import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  ReviewedLayerMark,
  ReviewedLayerRemoval,
  ReviewedLayerSave,
  WorktreeReviewedLayerMark,
} from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: WorktreeKey): ReviewedLayerMark[];
  byWorktrees(input: WorktreeKeys): WorktreeReviewedLayerMark[];
  save(input: ReviewedLayerSave): void;
  remove(input: ReviewedLayerRemoval): void;
}
