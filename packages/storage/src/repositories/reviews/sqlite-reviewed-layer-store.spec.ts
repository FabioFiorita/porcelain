import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { ReviewedLayerStore, ReviewStore } from '@porcelain/reviews/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  reviewedLayerStoreContract,
  reviewFixture,
  reviewSave,
} from '@porcelain/reviews/store-contracts';

reviewedLayerStoreContract('SqliteReviewedLayerStore', async (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  const reviews = await session.runPromise(ReviewStore);
  for (const [index, reviewId] of worktreeIds.entries())
    await Effect.runPromise(
      reviews.save(
        reviewSave(
          reviewFixture({
            reviewId,
            branch: `feature-${index}`,
            summaryToken: `summary-${index}`,
          }),
        ),
      ),
    );
  return {
    store: await session.runPromise(ReviewedLayerStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
