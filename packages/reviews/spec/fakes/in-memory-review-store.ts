import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type { ProofFile, ProofFileKey } from '../../src/models/review-proof.ts';
import type {
  Review,
  ReviewActivity,
  ReviewSave,
  ReviewSummary,
  ReviewSummaryKey,
} from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

function activityKey(worktreeId: string, revision: number): string {
  return `${worktreeId}\0${revision}`;
}

export class InMemoryReviewStore implements ReviewStore {
  private readonly rows: Map<string, Review>;
  private readonly activity = new Map<string, boolean>();
  private readonly proofFiles = new Map<string, readonly ProofFile[]>();

  constructor(reviews: readonly Review[] = []) {
    this.rows = new Map(
      reviews.map((review) => [review.worktreeId, structuredClone(review)]),
    );
  }

  read(input: WorktreeKey): Review | undefined {
    const review = this.rows.get(input.worktreeId);
    return review && this.current(review);
  }

  byWorktrees(input: WorktreeKeys): Review[] {
    return input.worktreeIds
      .map((worktreeId) => this.rows.get(worktreeId))
      .filter((review) => review !== undefined)
      .map((review) => this.current(review));
  }

  findSummary(input: ReviewSummaryKey): ReviewSummary | undefined {
    return [...this.rows.values()]
      .filter((review) => review.summaryToken === input.token)
      .map((review) => ({
        summaryHtml: review.summaryHtml,
        summaryToken: review.summaryToken,
        summarySecret: review.summarySecret,
      }))
      .at(0);
  }

  save(input: ReviewSave): void {
    const { proofFiles, ...review } = input;
    this.rows.set(input.worktreeId, structuredClone(review));
    this.proofFiles.set(input.worktreeId, structuredClone(proofFiles ?? []));
    this.activity.delete(activityKey(input.worktreeId, input.revision));
  }

  readProofFile(input: ProofFileKey): ProofFile | undefined {
    const file = this.proofFiles
      .get(input.worktreeId)
      ?.find((candidate) => candidate.id === input.proofId);
    return file && structuredClone(file);
  }

  setActive(input: ReviewActivity): void {
    this.activity.set(
      activityKey(input.worktreeId, input.revision),
      input.active,
    );
  }

  private current(review: Review): Review {
    return {
      ...structuredClone(review),
      active:
        this.activity.get(activityKey(review.worktreeId, review.revision)) ??
        review.active,
    };
  }
}
