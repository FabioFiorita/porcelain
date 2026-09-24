import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import type { ReviewLayer, ReviewTexts } from '@porcelain/reviews/models';
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

function readme(text: string): ReviewTexts {
  return new Map([['README.md', text]]);
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
    };
    expect(result).toEqual(mark);
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
      }).fingerprint,
    ).toBe(seen);
  });

  it.each([
    { name: 'its text changed', texts: readme('first\nchanged\n') },
    { name: 'its file is gone', texts: new Map<string, string>() },
  ])(
    'refuses a fingerprint the layer no longer has because $name, and stores nothing',
    ({ texts }) => {
      const { service, store } = setup();
      expect(() =>
        service.execute({ worktreeId, layer, fingerprint: seen, texts }),
      ).toThrow(ReviewedMarkConflictError);
      expect(store.list({ worktreeId })).toEqual([]);
    },
  );
});
