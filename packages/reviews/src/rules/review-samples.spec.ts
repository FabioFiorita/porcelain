import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { reviewSamples } from './review-samples.ts';
const review = reviewFixture({
  layers: [
    {
      id: 'layer',
      title: 'Decision',
      summary: 'Decision',
      lanes: ['Code'],
      fingerprint: 'f',
      steps: [
        'packages/contracts/src/value.ts',
        'src/low.ts',
        'src/other.ts',
        'src/last.ts',
      ].map((path, index) => ({
        id: `step-${index}`,
        title: 'Slice',
        text: 'Read',
        kind: 'changed' as const,
        lane: 0,
        pointer: { path, startLine: 1, endLine: 1 },
        published: ['a'],
      })),
    },
  ],
});
it('picks at most two distinct saved slices, with reproducible picks for a publication entropy', () => {
  const picks = reviewSamples(review, 'revision-one');
  expect(picks).toHaveLength(2);
  expect(new Set(picks.map((pick) => pick.stepId)).size).toBe(2);
  expect(picks.every((pick) => pick.layerId === 'layer' && !pick.sampled)).toBe(
    true,
  );
  expect(reviewSamples(review, 'revision-one')).toEqual(picks);
  expect(reviewSamples({ ...review, layers: [] }, 'empty')).toEqual([]);
  expect(
    reviewSamples(
      {
        ...review,
        layers: review.layers.map((layer) => ({
          ...layer,
          steps: layer.steps.slice(0, 1),
        })),
      },
      'one',
    ),
  ).toEqual([{ layerId: 'layer', stepId: 'step-0', sampled: false }]);
});
it('weights contract risk while still giving ordinary slices a chance on other revisions', () => {
  const counts = new Map<string, number>();
  for (let seed = 0; seed < 100; seed++)
    for (const pick of reviewSamples(review, `revision-${seed}`))
      counts.set(pick.stepId, (counts.get(pick.stepId) ?? 0) + 1);
  expect(counts.get('step-0')).toBeGreaterThan(counts.get('step-1') ?? 0);
  expect(counts.get('step-1')).toBeGreaterThan(0);
  expect(counts.get('step-2')).toBeGreaterThan(0);
  expect(counts.get('step-3')).toBeGreaterThan(0);
});
