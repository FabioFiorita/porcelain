import type { Effect } from 'effect';
import { Context } from 'effect';
import {
  type ReviewedFileKey,
  type ReviewedFileMark,
  type ReviewedFileRemoval,
  type ReviewedFileSave,
  type ReviewedFileStaleness,
} from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(input: ReviewedFileKey): Effect.Effect<ReviewedFileMark[]>;
  save(input: ReviewedFileSave): Effect.Effect<void>;
  remove(input: ReviewedFileRemoval): Effect.Effect<void>;
  setStale(input: ReviewedFileStaleness): Effect.Effect<void>;
}

export const ReviewedFileStore = Context.Service<
  '@porcelain/reviews/ReviewedFileStore',
  ReviewedFileStore
>('@porcelain/reviews/ReviewedFileStore');
