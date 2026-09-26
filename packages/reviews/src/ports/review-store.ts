import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  Review,
  ReviewActivity,
  ReviewSummary,
  ReviewSummaryKey,
} from '../models/review.ts';

export interface ReviewStore {
  read(input: WorktreeKey): Review | undefined;
  byWorktrees(input: WorktreeKeys): Review[];
  findSummary(input: ReviewSummaryKey): ReviewSummary | undefined;
  save(input: Review): void;
  setActive(input: ReviewActivity): void;
}
