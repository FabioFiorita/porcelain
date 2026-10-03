import { describe, expect, it } from 'vitest';
import type { FileChange } from '@porcelain/kernel/models';
import type { Review, ReviewEvidence } from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { RecordReviewActivityService } from './record-review-activity-service.ts';

const worktreeId = 'a'.repeat(64);
const readme = 'first\nsecond\nadded\n';

function review(overrides: Partial<Review> = {}): Review {
  return {
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
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
    ...overrides,
  };
}

const modified: FileChange = {
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
};
const committed: ReviewEvidence = {
  changes: [],
  texts: new Map([['README.md', readme]]),
  diffs: [],
};
const stillChanged: ReviewEvidence = {
  changes: [modified],
  texts: new Map([['README.md', readme]]),
  diffs: [
    {
      selection: {
        scope: 'unstaged',
        oldPath: 'README.md',
        newPath: 'README.md',
      },
      content: { kind: 'text', patch: '@@ -2,0 +3 @@\n+added\n' },
    },
  ],
};

function setup(stored: Review) {
  const store = new InMemoryReviewStore();
  store.save(stored);
  return { store, service: new RecordReviewActivityService(store) };
}

describe('RecordReviewActivityService', () => {
  it('records the review inactive once every line it explains is committed', () => {
    const { store, service } = setup(review());
    expect(service.execute({ review: review(), evidence: committed })).toEqual({
      changed: true,
    });
    expect(store.read({ worktreeId })?.active).toBe(false);
  });

  it('records the review active again while a line it explains still changes', () => {
    const { store, service } = setup(review({ active: false }));
    service.execute({
      review: review({ active: false }),
      evidence: stillChanged,
    });
    expect(store.read({ worktreeId })?.active).toBe(true);
  });

  it('reports no change while the review stays as active as it was', () => {
    const { service } = setup(review());
    expect(
      service.execute({ review: review(), evidence: stillChanged }),
    ).toEqual({ changed: false });
  });

  it('leaves a review published after the one it resolved alone', () => {
    const { store, service } = setup(review({ revision: 2 }));
    service.execute({ review: review(), evidence: committed });
    expect(store.read({ worktreeId })).toMatchObject({
      revision: 2,
      active: true,
    });
  });
});
