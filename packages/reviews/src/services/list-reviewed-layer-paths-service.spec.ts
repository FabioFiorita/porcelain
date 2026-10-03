import { describe, expect, it } from 'vitest';
import type { ReviewLayer } from '@porcelain/reviews/models';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { ListReviewedLayerPathsService } from './list-reviewed-layer-paths-service.ts';

const worktreeId = 'a'.repeat(64);

function layer(id: string, path: string): ReviewLayer {
  return {
    id,
    title: 'Layer',
    summary: 'A layer',
    lanes: ['Docs'],
    fingerprint: 'published',
    steps: [
      {
        id: `${id}-step`,
        lane: 0,
        title: 'Step',
        text: 'A line is added',
        kind: 'changed',
        pointer: { path, startLine: 2, endLine: 2 },
        published: ['added'],
      },
    ],
  };
}

const readmeLayer = layer('layer-1', 'README.md');
const guideLayer = layer('layer-2', 'GUIDE.md');
const reviewed = 'first\nadded\n';

function setup() {
  const reviews = new InMemoryReviewStore();
  reviews.save({
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [readmeLayer, guideLayer],
  });
  const marks = new InMemoryReviewedLayerStore();
  marks.save({
    worktreeId,
    marks: [
      {
        layerId: readmeLayer.id,
        fingerprint: currentLayerFingerprint(
          readmeLayer,
          new Map([['README.md', reviewed]]),
        ),
        reviewedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
  return {
    marks,
    paths: new ListReviewedLayerPathsService(reviews, marks),
  };
}

describe('ListReviewedLayerPathsService', () => {
  it('names only the files that the marked layers point at', () => {
    expect(setup().paths.execute({ worktreeId })).toEqual({
      paths: ['README.md'],
    });
  });
});
