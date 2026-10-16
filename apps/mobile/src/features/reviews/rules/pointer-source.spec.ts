import { expect, it } from 'vitest';
import type { ReviewStep } from '@porcelain/client/reviews/rules';
import { pointerSource } from './pointer-source';

const step: ReviewStep = {
  id: 'step',
  lane: 0,
  kind: 'context',
  title: 'The existing owner',
  text: 'Reuse the owner.',
  pointer: {
    path: 'src/owner.ts',
    startLine: 2,
    endLine: 3,
    textFingerprint: 'published',
  },
  location: { state: 'current', startLine: 10, endLine: 11 },
};
const source = Array.from(
  { length: 20 },
  (_, index) => `source ${index + 1}`,
).join('\r\n');
it('opens the resolved range with surrounding context and original source line numbers', () => {
  expect(pointerSource(step, source, false)).toEqual([
    { id: '7', text: 'source 7', newLine: 7 },
    { id: '8', text: 'source 8', newLine: 8 },
    { id: '9', text: 'source 9', newLine: 9 },
    { id: '10', text: 'source 10', newLine: 10 },
    { id: '11', text: 'source 11', newLine: 11 },
    { id: '12', text: 'source 12', newLine: 12 },
    { id: '13', text: 'source 13', newLine: 13 },
    { id: '14', text: 'source 14', newLine: 14 },
  ]);
});
it('uses the published range for changed code and keeps the complete file reachable', () => {
  const changed: ReviewStep = { ...step, location: { state: 'changed' } };
  expect(
    pointerSource(changed, source, false).map((line) => line.newLine),
  ).toEqual([1, 2, 3, 4, 5, 6]);
  expect(pointerSource(step, source, true)).toHaveLength(20);
  expect(pointerSource(step, source, true).at(-1)).toEqual({
    id: '20',
    text: 'source 20',
    newLine: 20,
  });
});
it('uses resolved committed coordinates and clamps surrounding context to the file', () => {
  expect(
    pointerSource(
      { ...step, location: { state: 'committed', startLine: 2, endLine: 2 } },
      'first\nsecond',
      false,
    ),
  ).toEqual([
    { id: '1', text: 'first', newLine: 1 },
    { id: '2', text: 'second', newLine: 2 },
  ]);
});
