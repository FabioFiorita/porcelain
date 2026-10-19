import { Effect, Layer } from 'effect';
import { BranchReviewReader, ReviewStore } from '@porcelain/reviews/ports';
import { WorktreeCatalogStore } from '@porcelain/projects/ports';

export const catalogBranchReviewReaderLayer = Layer.effect(
  BranchReviewReader,
  Effect.gen(function* () {
    const catalog = yield* WorktreeCatalogStore;
    const reviews = yield* ReviewStore;
    const read = Effect.fn('BranchReviewReader.read')(function* (input: {
      worktreeId: string;
    }) {
      const entry = catalog.find(input);
      const worktree = entry?.worktree;
      if (worktree?.branch === undefined) return undefined;
      const record = yield* reviews.findOpen({
        projectId: worktree.projectId,
        branch: worktree.branch.replace(/^refs\/heads\//, ''),
      });
      if (record === undefined) return undefined;
      const review = yield* reviews.read({ reviewId: record.reviewId });
      return review === undefined
        ? undefined
        : { ...review, worktreeId: input.worktreeId };
    });
    return {
      read,
      byWorktrees: Effect.fn('BranchReviewReader.byWorktrees')(
        function* (input: { worktreeIds: readonly string[] }) {
          const found = yield* Effect.forEach(input.worktreeIds, (worktreeId) =>
            read({ worktreeId }),
          );
          return found.filter((review) => review !== undefined);
        },
      ),
    };
  }),
);
