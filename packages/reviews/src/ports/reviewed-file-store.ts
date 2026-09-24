import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  ReviewedFileMark,
  ReviewedFileRemoval,
  ReviewedFileSave,
  ReviewedFileStaleness,
} from '../models/reviewed-mark.ts';

export interface ReviewedFileStore {
  list(input: WorktreeKey): ReviewedFileMark[];
  save(input: ReviewedFileSave): void;
  remove(input: ReviewedFileRemoval): void;
  setStale(input: ReviewedFileStaleness): void;
}
