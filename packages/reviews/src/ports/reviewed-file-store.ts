import type {
  ReviewedFileKey,
  ReviewedFileMark,
  ReviewedFileRemoval,
  ReviewedFileSave,
  ReviewedFileStaleness,
} from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(input: ReviewedFileKey): ReviewedFileMark[];
  save(input: ReviewedFileSave): void;
  remove(input: ReviewedFileRemoval): void;
  setStale(input: ReviewedFileStaleness): void;
}
