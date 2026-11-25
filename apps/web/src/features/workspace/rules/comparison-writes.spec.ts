import { expect, it } from 'vite-plus/test';
import { comparisonWrites } from './comparison-writes';

const stagedDeletion = { scope: 'staged', current: false };
const untracked = { scope: 'untracked', current: true };
const file = [stagedDeletion, untracked];
const current = (comparison: { current: boolean }) => comparison.current;

it('withholds the file review from every comparison while any comparison of the file is not current', () => {
  expect(comparisonWrites(file, untracked, current)).toEqual({
    discard: true,
    review: false,
  });
  expect(comparisonWrites(file, stagedDeletion, current)).toEqual({
    discard: false,
    review: false,
  });
});

it('allows the file review once every comparison of the file is current', () => {
  const settled = [{ ...stagedDeletion, current: true }, untracked];
  expect(comparisonWrites(settled, untracked, current)).toEqual({
    discard: true,
    review: true,
  });
});
