import { describe, expect, it } from 'vitest';
import type { FileChange } from '@porcelain/kernel/models';
import type {
  Review,
  ReviewDiff,
  ReviewTextRead,
} from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { RefreshReviewActivityService } from './refresh-review-activity-service.ts';

const worktreeId = 'a'.repeat(64);
const readme = 'first\nsecond\nadded\n';

function review(active: boolean): Review {
  return {
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active,
    summaryHtml: '<p>Summary</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [
      {
        id: 'layer-1',
        title: 'Readme',
        summary: 'Adds a line',
        lanes: ['Docs'],
        fingerprint: 'published',
        steps: [
          {
            id: 'step-1',
            lane: 0,
            title: 'New line',
            text: 'A line is added',
            kind: 'changed',
            pointer: { path: 'README.md', startLine: 3, endLine: 3 },
            published: ['added'],
          },
        ],
      },
    ],
  };
}

const texts: ReviewTextRead[] = [
  { status: 'fulfilled', value: { path: 'README.md', text: readme } },
];
const changes: FileChange[] = [
  {
    path: 'README.md',
    fingerprint: 'f',
    comparisons: [
      {
        scope: 'unstaged',
        kind: 'modified',
        oldPath: 'README.md',
        newPath: 'README.md',
        oldMode: '100644',
        newMode: '100644',
        oldOid: undefined,
        newOid: undefined,
        supported: true,
      },
    ],
  },
];
const diffs: ReviewDiff[] = [
  {
    selection: {
      scope: 'unstaged',
      oldPath: 'README.md',
      newPath: 'README.md',
    },
    content: { kind: 'text', patch: '@@ -2,0 +3 @@\n+added\n' },
  },
];

function setup(stored: Review) {
  const store = new InMemoryReviewStore();
  store.save(stored);
  return { store, service: new RefreshReviewActivityService(store) };
}

describe('RefreshReviewActivityService', () => {
  it('records the review inactive once every line it explains is committed', () => {
    const { store, service } = setup(review(true));
    service.execute({ review: review(true), changes: [], texts, diffs: [] });
    expect(store.read({ worktreeId })?.active).toBe(false);
  });

  it('records the review active again while a line it explains still changes', () => {
    const { store, service } = setup(review(false));
    service.execute({ review: review(false), changes, texts, diffs });
    expect(store.read({ worktreeId })?.active).toBe(true);
  });

  it('keeps the review as it is when its activity has not changed', () => {
    const { store, service } = setup(review(true));
    service.execute({ review: review(true), changes, texts, diffs });
    expect(store.read({ worktreeId })?.active).toBe(true);
  });
});
