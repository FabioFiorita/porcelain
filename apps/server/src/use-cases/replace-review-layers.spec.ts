import { expect, it } from 'vitest';
import { ReviewLayerConflictError } from '../repositories/errors/review-layer-conflict-error.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import { ReplaceReviewLayers } from './replace-review-layers.ts';

it('keeps conflict handling with the atomic storage owner without retrying stale intent', () => {
  const conflict = new ReviewLayerConflictError();
  const revisions: number[] = [];
  const store: ReviewLayerStore = {
    read: () => {
      throw new Error('A preflight read cannot guarantee an atomic update');
    },
    replace: (_id, revision) => {
      revisions.push(revision);
      throw conflict;
    },
  };
  expect(() =>
    new ReplaceReviewLayers(store).execute('worktree', 3, []),
  ).toThrow(conflict);
  expect(revisions).toEqual([3]);
});
