import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import type { ReviewLayer, ReviewTextRead } from '@porcelain/reviews/models';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { SetReviewedLayerService } from './set-reviewed-layer-service.ts';

const worktreeId = 'a'.repeat(64);

const layer: ReviewLayer = {
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
      pointer: { path: 'README.md', startLine: 2, endLine: 2 },
      published: ['added'],
    },
  ],
};

function readme(text: string): ReviewTextRead[] {
  return [{ status: 'fulfilled', value: { path: 'README.md', text } }];
}

const seen = currentLayerFingerprint(
  layer,
  new Map([['README.md', 'first\nadded\n']]),
);

function setup() {
  const store = new InMemoryReviewedLayerStore();
  return {
    store,
    service: new SetReviewedLayerService(
      store,
      new FixedClock('2026-01-01T00:00:00.000Z'),
    ),
  };
}

describe('SetReviewedLayerService', () => {
  it('marks a layer at the fingerprint it has in the current files', () => {
    const { service, store } = setup();
    const result = service.execute({
      worktreeId,
      layer,
      fingerprint: seen,
      texts: readme('first\nadded\n'),
    });
    const mark = {
      layerId: 'layer-1',
      fingerprint: seen,
      reviewedAt: '2026-01-01T00:00:00.000Z',
      stale: false,
    };
    expect(result).toEqual({ worktreeId, marks: [mark] });
    expect(store.list({ worktreeId })).toEqual([mark]);
  });

  it('still accepts the fingerprint when the step text only moved', () => {
    const { service } = setup();
    expect(
      service.execute({
        worktreeId,
        layer,
        fingerprint: seen,
        texts: readme('zero\nfirst\nadded\n'),
      }).marks,
    ).toHaveLength(1);
  });

  it('refuses a fingerprint the layer no longer has and stores nothing', () => {
    const { service, store } = setup();
    for (const texts of [readme('first\nchanged\n'), []])
      expect(() =>
        service.execute({ worktreeId, layer, fingerprint: seen, texts }),
      ).toThrow(ReviewedMarkConflictError);
    expect(store.list({ worktreeId })).toEqual([]);
  });

  it('marks a stale layer fresh again at its new fingerprint', () => {
    const { service, store } = setup();
    service.execute({
      worktreeId,
      layer,
      fingerprint: seen,
      texts: readme('first\nadded\n'),
    });
    store.setStale({ worktreeId, layerIds: ['layer-1'], stale: true });
    service.execute({
      worktreeId,
      layer,
      fingerprint: seen,
      texts: readme('first\nadded\n'),
    });
    expect(store.list({ worktreeId })).toEqual([
      expect.objectContaining({ layerId: 'layer-1', stale: false }),
    ]);
  });
});
