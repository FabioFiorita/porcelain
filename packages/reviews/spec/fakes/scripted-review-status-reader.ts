import type { ChangeComparison } from '@porcelain/kernel/models';
import type {
  ReadReviewStatusInput,
  ReviewStatus,
} from '../../src/models/read-review-evidence.ts';
import type { ReviewStatusReader } from '../../src/ports/review-status-reader.ts';

export class ScriptedReviewStatusReader implements ReviewStatusReader {
  private readonly statuses: ReadonlyMap<string, ChangeComparison[]>;

  constructor(statuses: ReadonlyMap<string, ChangeComparison[]>) {
    this.statuses = statuses;
  }

  async execute(input: ReadReviewStatusInput): Promise<ReviewStatus> {
    return { changes: this.statuses.get(input.worktreeId) ?? [] };
  }
}
