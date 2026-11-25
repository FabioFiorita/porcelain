import { expect, it } from 'vite-plus/test';
import { comparisonWrites, type ComparisonRead } from './comparison-writes';

it.each<{ staged: ComparisonRead; situation: string }>([
  { staged: 'retained', situation: 'only a retained patch' },
  { staged: 'missing', situation: 'no current diff yet' },
])(
  'withholds the file review while its staged deletion has $situation and its untracked text is current',
  ({ staged }) => {
    const file = [staged, 'current'] as const;
    expect(comparisonWrites(file, 'current')).toEqual({
      discard: true,
      review: false,
    });
    expect(comparisonWrites(file, staged)).toEqual({
      discard: false,
      review: false,
    });
  },
);

it('allows the file review once every comparison is current or never read, such as a conflict', () => {
  const file = ['current', 'never-read'] as const;
  expect(comparisonWrites(file, 'current')).toEqual({
    discard: true,
    review: true,
  });
});
