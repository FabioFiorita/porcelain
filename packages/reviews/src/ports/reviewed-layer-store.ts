import type { Effect } from 'effect';
import { Context } from 'effect';
import { type WorktreeKey, type WorktreeKeys } from '@porcelain/kernel/models';
import {
  type ReviewedLayerMark,
  type ReviewedLayerRemoval,
  type ReviewedLayerSave,
  type WorktreeReviewedLayerMark,
} from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: WorktreeKey): Effect.Effect<ReviewedLayerMark[]>;
  byWorktrees(input: WorktreeKeys): Effect.Effect<WorktreeReviewedLayerMark[]>;
  save(input: ReviewedLayerSave): Effect.Effect<void>;
  remove(input: ReviewedLayerRemoval): Effect.Effect<void>;
}

export const ReviewedLayerStore = Context.Service<
  '@porcelain/reviews/ReviewedLayerStore',
  ReviewedLayerStore
>('@porcelain/reviews/ReviewedLayerStore');
