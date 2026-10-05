import { Context } from 'effect';
import {
  type ReviewedFileKey,
  type ReviewedFileMark,
  type ReviewedFileRemoval,
  type ReviewedFileSave,
  type ReviewedFileStaleness,
} from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(input: ReviewedFileKey): ReviewedFileMark[];
  save(input: ReviewedFileSave): void;
  remove(input: ReviewedFileRemoval): void;
  setStale(input: ReviewedFileStaleness): void;
}

export const ReviewedFileStore = Context.Service<
  '@porcelain/reviews/ReviewedFileStore',
  ReviewedFileStore
>('@porcelain/reviews/ReviewedFileStore');
