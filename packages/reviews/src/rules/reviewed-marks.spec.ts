import { expect, it } from 'vitest';
import { reviewedLayerMarks } from './reviewed-marks.ts';

it('carries a decision mark only at the same fingerprint and prefers an exact mark over a stale revision', () => {
  const layer = {
    id: 'decision',
    title: 'Owner',
    summary: 'One owner',
    lanes: ['Owner'],
    steps: [],
    fingerprint: 'second',
  };
  const first = {
    layerId: 'decision',
    fingerprint: 'first',
    reviewedAt: '2026-10-19T00:00:00.000Z',
  };
  const second = { ...first, fingerprint: 'second' };
  expect(reviewedLayerMarks([first], [layer])).toEqual([
    { ...first, stale: true },
  ]);
  expect(reviewedLayerMarks([first, second], [layer])).toEqual([
    { ...second, stale: false },
  ]);
  expect(
    reviewedLayerMarks([first, second], [{ ...layer, fingerprint: 'first' }]),
  ).toEqual([{ ...first, stale: false }]);
  expect(reviewedLayerMarks([first], [])).toEqual([]);
});
