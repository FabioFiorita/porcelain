import type { Review, ReviewSummary } from '../models/review.ts';

export interface ReviewStore {
  read(input: { worktreeId: string }): Review | undefined;
  findSummary(input: { token: string }): ReviewSummary | undefined;
  save(input: Review): void;
  setActive(input: {
    worktreeId: string;
    revision: number;
    active: boolean;
  }): void;
}
