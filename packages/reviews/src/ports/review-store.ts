import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type { ProofFile, ProofFileKey } from '../models/review-proof.ts';
import type {
  Review,
  ReviewActivity,
  ReviewSave,
  ReviewSummary,
  ReviewSummaryKey,
} from '../models/review.ts';

export interface ReviewStore {
  read(input: WorktreeKey): Review | undefined;
  byWorktrees(input: WorktreeKeys): Review[];
  findSummary(input: ReviewSummaryKey): ReviewSummary | undefined;
  save(input: ReviewSave): void;
  readProofFile(input: ProofFileKey): ProofFile | undefined;
  setActive(input: ReviewActivity): void;
}
