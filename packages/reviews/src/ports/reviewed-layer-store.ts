import type { Effect } from 'effect';
import { Context } from 'effect';
import {
  type ReviewedLayerMark,
  type ReviewedLayerRemoval,
  type ReviewedLayerSave,
} from '../models/reviewed-mark.ts';

export interface ReviewedLayerStore {
  list(input: { reviewId: string }): Effect.Effect<ReviewedLayerMark[]>;
  save(input: ReviewedLayerSave): Effect.Effect<void>;
  remove(input: ReviewedLayerRemoval): Effect.Effect<void>;
}

export const ReviewedLayerStore = Context.Service<
  '@porcelain/reviews/ReviewedLayerStore',
  ReviewedLayerStore
>('@porcelain/reviews/ReviewedLayerStore');
