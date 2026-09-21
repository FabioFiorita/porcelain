import { describe, expect, it } from 'vitest';
import { publishReviewSchema } from './review.ts';

function review() {
  return {
    expectedRevision: 0,
    summaryHtml: '<title>Review</title>',
    layers: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        title: 'Layer',
        summary: 'Summary',
        lanes: ['Code'],
        steps: [
          {
            id: '20000000-0000-4000-8000-000000000001',
            lane: 0,
            title: 'Step',
            text: 'Explanation',
            kind: 'changed',
            pointer: { path: 'src/a.ts', startLine: 1, endLine: 1 },
          },
        ],
      },
    ],
  };
}

describe('published review contract', () => {
  it('rejects duplicate layer identities', () => {
    const value = review();
    const firstLayer = value.layers[0];
    if (!firstLayer) throw new Error('Missing fixture layer');
    value.layers.push({ ...firstLayer, steps: [...firstLayer.steps] });
    expect(() => publishReviewSchema.parse(value)).toThrow(
      'Duplicate layer ID',
    );
  });

  it('measures the summary as UTF-8 and rejects malformed Unicode', () => {
    const tooLarge = review();
    tooLarge.summaryHtml = '😀'.repeat(2_621_441);
    expect(() => publishReviewSchema.parse(tooLarge)).toThrow(
      'Summary exceeds 10 MiB',
    );
    const malformed = review();
    malformed.summaryHtml = '\ud800';
    expect(() => publishReviewSchema.parse(malformed)).toThrow(
      'Expected valid Unicode text',
    );
  });
});
