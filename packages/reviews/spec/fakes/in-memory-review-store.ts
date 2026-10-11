import { Effect } from 'effect';
import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type { ProofFile, ProofFileKey } from '../../src/models/review-proof.ts';
import type {
  Review,
  ReviewActivity,
  ReviewSave,
  ReviewSummary,
  ReviewSummaryKey,
} from '../../src/models/review.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';
import { InMemoryReviewedLayerStore } from './in-memory-reviewed-layer-store.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

export class InMemoryReviewStore implements ReviewStore {
  private readonly rows: Map<string, Review>;
  private readonly activity = new Map<string, Map<number, boolean>>();
  private readonly reviewedLayers: ReviewedLayerStore;
  private readonly proofFiles = new Map<string, readonly ProofFile[]>();

  constructor(
    reviews: readonly Review[] = [],
    reviewedLayers: ReviewedLayerStore = new InMemoryReviewedLayerStore(),
  ) {
    this.reviewedLayers = reviewedLayers;
    this.rows = new Map(
      reviews.map((review) => [review.worktreeId, structuredClone(review)]),
    );
  }

  read(input: WorktreeKey): Effect.Effect<Review | undefined> {
    return Effect.sync(() => {
      const review = this.rows.get(input.worktreeId);
      return review && this.current(review);
    });
  }

  byWorktrees(input: WorktreeKeys): Effect.Effect<Review[]> {
    return Effect.sync(() => {
      return input.worktreeIds
        .map((worktreeId) => this.rows.get(worktreeId))
        .filter((review) => review !== undefined)
        .map((review) => this.current(review));
    });
  }

  findSummary(
    input: ReviewSummaryKey,
  ): Effect.Effect<ReviewSummary | undefined> {
    return Effect.sync(() => {
      return [...this.rows.values()]
        .filter((review) => review.summaryToken === input.token)
        .map((review) => ({
          summaryHtml: review.summaryHtml,
          summaryToken: review.summaryToken,
          summarySecret: review.summarySecret,
        }))
        .at(0);
    });
  }

  remove(input: WorktreeKey): Effect.Effect<boolean> {
    return Effect.flatMap(
      Effect.sync(() => {
        this.proofFiles.delete(input.worktreeId);
        this.activity.delete(input.worktreeId);
        return this.rows.delete(input.worktreeId);
      }),
      (removed) =>
        this.reviewedLayers.list(input).pipe(
          Effect.flatMap((marks) =>
            Effect.forEach(marks, (mark) =>
              this.reviewedLayers.remove({ ...input, layerId: mark.layerId }),
            ),
          ),
          Effect.as(removed),
        ),
    );
  }

  save(input: ReviewSave): Effect.Effect<void> {
    return Effect.sync(() => {
      const { proofFiles, ...review } = input;
      this.rows.set(input.worktreeId, structuredClone(review));
      this.proofFiles.set(input.worktreeId, structuredClone(proofFiles ?? []));
      this.activity.get(input.worktreeId)?.delete(input.revision);
    });
  }

  readProofFile(input: ProofFileKey): Effect.Effect<ProofFile | undefined> {
    return Effect.sync(() => {
      const file = this.proofFiles
        .get(input.worktreeId)
        ?.find((candidate) => candidate.id === input.proofId);
      return file && structuredClone(file);
    });
  }

  setActive(input: ReviewActivity): Effect.Effect<void> {
    return Effect.sync(() => {
      const revisions = new Map(this.activity.get(input.worktreeId));
      revisions.set(input.revision, input.active);
      this.activity.set(input.worktreeId, revisions);
    });
  }

  private current(review: Review): Review {
    return {
      ...structuredClone(review),
      active:
        this.activity.get(review.worktreeId)?.get(review.revision) ??
        review.active,
    };
  }
}
