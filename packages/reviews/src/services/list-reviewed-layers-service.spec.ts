import { describe, expect, it } from 'vitest';
import type { ReviewLayer } from '@porcelain/reviews/models';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { ListReviewedLayersService } from './list-reviewed-layers-service.ts';

const worktreeId = 'a'.repeat(64);
const layer: ReviewLayer = {
  id: 'layer-1',
  title: 'Layer',
  summary: 'A layer',
  lanes: ['Docs'],
  fingerprint: 'published',
  steps: [
    {
      id: 'step',
      lane: 0,
      title: 'Step',
      text: 'A line is added',
      kind: 'changed',
      pointer: { path: 'README.md', startLine: 2, endLine: 2 },
      published: ['added'],
    },
  ],
};
const reviewed = new Map([['README.md', 'first\nadded\n']]);

function service() {
  const reviews = new InMemoryReviewStore();
  reviews.save({
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [layer],
  });
  const marks = new InMemoryReviewedLayerStore();
  marks.save({
    worktreeId,
    marks: [
      {
        layerId: layer.id,
        fingerprint: currentLayerFingerprint(layer, reviewed),
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
  return new ListReviewedLayersService(reviews, marks);
}

describe('ListReviewedLayersService', () => {
  it('answers a mark fresh while the lines it covers read as they did', () => {
    expect(
      service().execute({ worktreeId, texts: reviewed }).marks,
    ).toMatchObject([{ layerId: layer.id, stale: false }]);
  });

  it('answers a mark stale once the lines it covers changed, computed on this read', () => {
    expect(
      service().execute({
        worktreeId,
        texts: new Map([['README.md', 'first\nchanged\n']]),
      }).marks,
    ).toMatchObject([{ layerId: layer.id, stale: true }]);
  });
});
