import { Effect } from 'effect';
import type { Review, ReviewRecord } from '../../src/models/review.ts';
import type { ProofFile } from '../../src/models/review-proof.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';
import type { BranchReviewReader } from '../../src/ports/branch-review-reader.ts';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';
import { openReviewForKey } from '../../src/rules/review-record.ts';
import { InMemoryReviewedLayerStore } from './in-memory-reviewed-layer-store.ts';

export class InMemoryReviewStore implements ReviewStore {
  private readonly records: Map<string, ReviewRecord>;
  private readonly rows: Map<string, Review[]>;
  private readonly proofFiles = new Map<string, ProofFile[]>();
  private readonly states = new Map<string, 'open' | 'closed'>();
  private readonly seen = new Map<string, number>();
  private readonly layers: ReviewedLayerStore;
  constructor(
    reviews: readonly Review[] = [],
    layers: ReviewedLayerStore = new InMemoryReviewedLayerStore(),
  ) {
    this.layers = layers;
    this.records = new Map(
      reviews.map((review) => [
        review.reviewId,
        {
          reviewId: review.reviewId,
          projectId: review.projectId,
          commonDirectory: review.commonDirectory,
          branch: review.branch,
          state: 'open',
          latestRevision: review.revision,
          lastSeenRevision: 0,
        },
      ]),
    );
    this.rows = new Map(
      reviews.map((review) => [review.reviewId, [structuredClone(review)]]),
    );
  }
  read(
    input: Parameters<ReviewStore['read']>[0],
  ): ReturnType<ReviewStore['read']> {
    return Effect.sync(() =>
      structuredClone(
        this.rows
          .get(input.reviewId)
          ?.find(
            (review) =>
              review.revision ===
              (input.revision ??
                this.records.get(input.reviewId)?.latestRevision),
          ),
      ),
    );
  }
  readRecord(
    input: Parameters<ReviewStore['readRecord']>[0],
  ): ReturnType<ReviewStore['readRecord']> {
    return Effect.sync(() =>
      [...this.records.values()]
        .filter((record) => record.reviewId === input.reviewId)
        .map((record) => ({
          ...structuredClone(record),
          archived: this.archived.has(record.reviewId),
          state: this.states.get(record.reviewId) ?? record.state,
          lastSeenRevision:
            this.seen.get(record.reviewId) ?? record.lastSeenRevision,
        }))
        .at(0),
    );
  }
  list(
    input: Parameters<ReviewStore['list']>[0],
  ): ReturnType<ReviewStore['list']> {
    return Effect.sync(() =>
      [...this.records.values()]
        .reverse()
        .filter((record) => record.projectId === input.projectId)
        .map((record) => ({
          ...structuredClone(record),
          archived: this.archived.has(record.reviewId),
          state: this.states.get(record.reviewId) ?? record.state,
          lastSeenRevision:
            this.seen.get(record.reviewId) ?? record.lastSeenRevision,
        })),
    );
  }
  findOpen(
    input: Parameters<ReviewStore['findOpen']>[0],
  ): ReturnType<ReviewStore['findOpen']> {
    return this.list(input).pipe(
      Effect.map((records) => openReviewForKey(records, input)),
    );
  }
  listRevisions(
    input: Parameters<ReviewStore['listRevisions']>[0],
  ): ReturnType<ReviewStore['listRevisions']> {
    return Effect.sync(() =>
      structuredClone(this.rows.get(input.reviewId) ?? []),
    );
  }
  findSummary(
    input: Parameters<ReviewStore['findSummary']>[0],
  ): ReturnType<ReviewStore['findSummary']> {
    return Effect.sync(() =>
      [...this.rows.values()]
        .flat()
        .filter((review) => review.summaryToken === input.token)
        .map((review) => ({
          summaryHtml: review.summaryHtml,
          summaryToken: review.summaryToken,
          summarySecret: review.summarySecret,
        }))
        .at(0),
    );
  }
  save(
    input: Parameters<ReviewStore['save']>[0],
  ): ReturnType<ReviewStore['save']> {
    return Effect.sync(() => {
      const { record, expectedRevision: _, proofFiles, ...review } = input;
      this.records.set(input.reviewId, structuredClone(record));
      this.rows.set(input.reviewId, [
        ...(this.rows.get(input.reviewId) ?? []),
        structuredClone(review),
      ]);
      this.proofFiles.set(input.reviewId, [
        ...(this.proofFiles.get(input.reviewId) ?? []),
        ...structuredClone(proofFiles ?? []),
      ]);
    });
  }
  readProofFile(
    input: Parameters<ReviewStore['readProofFile']>[0],
  ): ReturnType<ReviewStore['readProofFile']> {
    return Effect.sync(() =>
      structuredClone(
        this.proofFiles
          .get(input.reviewId)
          ?.filter(
            (file) =>
              file.id === input.proofId &&
              (input.revision === undefined ||
                this.rows
                  .get(input.reviewId)
                  ?.find((review) => review.revision === input.revision)
                  ?.proof?.assets.some((asset) => asset.id === input.proofId)),
          )
          .at(0),
      ),
    );
  }
  remove(
    input: Parameters<ReviewStore['remove']>[0],
  ): ReturnType<ReviewStore['remove']> {
    return Effect.sync(() => {
      const removed = this.records.delete(input.reviewId);
      this.rows.delete(input.reviewId);
      this.proofFiles.delete(input.reviewId);
      this.states.delete(input.reviewId);
      this.seen.delete(input.reviewId);
      return removed;
    }).pipe(
      Effect.flatMap((removed) =>
        this.layers.list(input).pipe(
          Effect.flatMap((marks) =>
            Effect.forEach(marks, (mark) =>
              this.layers.remove({
                ...input,
                layerId: mark.layerId,
                fingerprint: mark.fingerprint,
              }),
            ),
          ),
          Effect.as(removed),
        ),
      ),
    );
  }

  setPullRequest(
    input: Parameters<ReviewStore['setPullRequest']>[0],
  ): ReturnType<ReviewStore['setPullRequest']> {
    return Effect.sync(() => {
      Object.assign(this.records.get(input.reviewId) ?? {}, {
        pullRequest: input.pullRequest,
      });
    });
  }
  setState(
    input: Parameters<ReviewStore['setState']>[0],
  ): ReturnType<ReviewStore['setState']> {
    return Effect.sync(() => {
      this.states.set(input.reviewId, input.state);
    });
  }
  markSeen(
    input: Parameters<ReviewStore['markSeen']>[0],
  ): ReturnType<ReviewStore['markSeen']> {
    return Effect.sync(() => {
      this.seen.set(
        input.reviewId,
        Math.max(
          this.seen.get(input.reviewId) ?? 0,
          Math.min(
            this.records.get(input.reviewId)?.latestRevision ?? 0,
            input.revision,
          ),
        ),
      );
    });
  }
  readonly archived = new Set<string>();
  readonly archive = (input: { reviewId: string }) =>
    Effect.sync(() => {
      this.archived.add(input.reviewId);
      this.states.set(input.reviewId, 'closed');
    });
  readonly branchReader: BranchReviewReader = {
    read: (input) =>
      Effect.sync(() =>
        structuredClone(
          [...this.rows.values()]
            .flatMap((rows) => rows.at(-1) ?? [])
            .find((review) => review.worktreeId === input.worktreeId),
        ),
      ),
    byWorktrees: (input) =>
      Effect.sync(() =>
        structuredClone(
          [...this.rows.values()]
            .flatMap((rows) => rows.at(-1) ?? [])
            .filter((review) => input.worktreeIds.includes(review.worktreeId)),
        ),
      ),
  };
}
