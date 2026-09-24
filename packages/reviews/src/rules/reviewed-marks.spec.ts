import { describe, expect, it } from 'vitest';
import type { ReviewLayer, ReviewedLayerMark } from '@porcelain/reviews/models';
import {
  currentLayerFingerprint,
  reviewedLayerMarks,
} from '@porcelain/reviews/rules';

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

const reviewed = new Map([['README.md', 'first\nadded\n']]);

function mark(fingerprint: string): ReviewedLayerMark {
  return {
    layerId: layer.id,
    fingerprint,
    reviewedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('reviewedLayerMarks', () => {
  it('marks a layer fresh while its lines read as they did when it was reviewed', () => {
    const seen = currentLayerFingerprint(layer, reviewed);
    expect(reviewedLayerMarks([mark(seen)], [layer], reviewed)).toEqual([
      { ...mark(seen), stale: false },
    ]);
  });

  it('marks a layer stale once its lines read differently', () => {
    const seen = currentLayerFingerprint(layer, reviewed);
    expect(
      reviewedLayerMarks(
        [mark(seen)],
        [layer],
        new Map([['README.md', 'first\nchanged\n']]),
      ),
    ).toEqual([{ ...mark(seen), stale: true }]);
  });

  it('marks a layer stale when the published review no longer has it', () => {
    const seen = currentLayerFingerprint(layer, reviewed);
    expect(reviewedLayerMarks([mark(seen)], [], reviewed)).toEqual([
      { ...mark(seen), stale: true },
    ]);
  });

  it('answers no marks when nothing was reviewed', () => {
    expect(reviewedLayerMarks([], [layer], reviewed)).toEqual([]);
  });
});
