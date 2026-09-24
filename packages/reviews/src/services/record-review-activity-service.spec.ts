import { describe, expect, it } from 'vitest';
import type { Review } from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { RecordReviewActivityService } from './record-review-activity-service.ts';

const worktreeId = 'a'.repeat(64);

function review(overrides: Partial<Review> = {}): Review {
  return {
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [],
    ...overrides,
  };
}

function setup(stored: Review) {
  const store = new InMemoryReviewStore();
  store.save(stored);
  return { store, service: new RecordReviewActivityService(store) };
}

describe('RecordReviewActivityService', () => {
  it('records that the review is no longer active', () => {
    const { store, service } = setup(review());
    service.execute({ review: review(), active: false });
    expect(store.read({ worktreeId })?.active).toBe(false);
  });

  it('records that the review is active again', () => {
    const { store, service } = setup(review({ active: false }));
    service.execute({ review: review({ active: false }), active: true });
    expect(store.read({ worktreeId })?.active).toBe(true);
  });

  it('leaves a review published after the one it resolved alone', () => {
    const { store, service } = setup(review({ revision: 2 }));
    service.execute({ review: review(), active: false });
    expect(store.read({ worktreeId })).toMatchObject({
      revision: 2,
      active: true,
    });
  });
});
