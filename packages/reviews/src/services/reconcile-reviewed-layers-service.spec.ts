import { describe, expect, it } from 'vitest';
import type { ReviewLayer, ReviewTexts } from '@porcelain/reviews/models';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { ListReviewedLayerPathsService } from '@porcelain/reviews/services';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { ReconcileReviewedLayersService } from './reconcile-reviewed-layers-service.ts';

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

function texts(path: string, content: string): ReviewTexts {
  return new Map([[path, content]]);
}

function setup(stale = false) {
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
        stale,
      },
    ],
  });
  return {
    marks,
    paths: new ListReviewedLayerPathsService(reviews, marks),
    reconcile: new ReconcileReviewedLayersService(reviews, marks),
  };
}

const staleness = (marks: InMemoryReviewedLayerStore) =>
  marks.list({ worktreeId }).map((mark) => [mark.layerId, mark.stale]);

describe('ListReviewedLayerPathsService', () => {
  it('names only the files that the marked layers point at', () => {
    expect(setup().paths.execute({ worktreeId })).toEqual({
      paths: ['README.md'],
    });
  });
});

describe('ReconcileReviewedLayersService', () => {
  it('flags a mark stale once the lines its layer points at changed', () => {
    const { marks, reconcile } = setup();
    reconcile.execute({
      worktreeId,
      texts: texts('README.md', 'first\nchanged\n'),
    });
    expect(staleness(marks)).toEqual([['layer-1', true]]);
  });

  it('clears the flag once the lines read as they did when marked', () => {
    const { marks, reconcile } = setup(true);
    reconcile.execute({ worktreeId, texts: texts('README.md', reviewed) });
    expect(staleness(marks)).toEqual([['layer-1', false]]);
  });

  it('flags a mark stale when its file can no longer be read', () => {
    const { marks, reconcile } = setup();
    reconcile.execute({ worktreeId, texts: new Map() });
    expect(staleness(marks)).toEqual([['layer-1', true]]);
  });
});
