import { expect, it } from 'vitest';
import { discardSelection } from './discard-selection';

it('rejects selections crossing from additions to deletions', () => {
  expect(
    discardSelection({
      start: 3,
      end: 5,
      side: 'additions',
      endSide: 'deletions',
    }),
  ).toBeUndefined();
});

it('rejects selections crossing from deletions to additions', () => {
  expect(
    discardSelection({
      start: 5,
      end: 3,
      side: 'deletions',
      endSide: 'additions',
    }),
  ).toBeUndefined();
});

it('keeps same-side additions and plain-file ranges in ascending order', () => {
  expect(
    discardSelection({
      start: 5,
      end: 3,
      side: 'additions',
      endSide: 'additions',
    }),
  ).toEqual({ startLine: 3, endLine: 5 });
  expect(discardSelection({ start: 3, end: 5 })).toEqual({
    startLine: 3,
    endLine: 5,
  });
  expect(discardSelection({ start: 3, end: 5, side: 'additions' })).toEqual({
    startLine: 3,
    endLine: 5,
  });
  expect(
    discardSelection({ start: 3, end: 5, side: 'deletions' }),
  ).toBeUndefined();
  expect(discardSelection(undefined)).toBeUndefined();
});
