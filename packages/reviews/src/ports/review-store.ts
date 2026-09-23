import type { Review, ReviewSummary } from '../models/review.ts';

export interface ReviewStore {
  read(worktreeId: string): Review | undefined;
  findSummary(token: string): ReviewSummary | undefined;
  save(review: Review): void;
  setActive(worktreeId: string, revision: number, active: boolean): void;
}
