import { describe, expect, it } from 'vitest';
import { findMatches, matchCountLabel, stepMatch } from './find-in-text.ts';

describe('findMatches', () => {
  it('finds nothing for an empty query', () => {
    expect(findMatches('alpha\nbeta', '', 100)).toEqual([]);
  });

  it('finds every occurrence by line and column, ignoring case', () => {
    expect(findMatches('Alpha alpha\nbeta\nALPHA', 'alpha', 100)).toEqual([
      { line: 1, column: 0 },
      { line: 1, column: 6 },
      { line: 3, column: 0 },
    ]);
  });

  it('does not count overlapping occurrences twice', () => {
    expect(findMatches('aaaa', 'aa', 100)).toEqual([
      { line: 1, column: 0 },
      { line: 1, column: 2 },
    ]);
  });

  it('finds matches far down a long text', () => {
    const text = [
      ...Array.from({ length: 5000 }, () => 'filler'),
      'needle',
    ].join('\n');
    expect(findMatches(text, 'needle', 100)).toEqual([
      { line: 5001, column: 0 },
    ]);
  });

  it('stops at the limit', () => {
    expect(findMatches('x'.repeat(30), 'x', 20)).toHaveLength(20);
  });
});

describe('stepMatch', () => {
  it('wraps forward from the last match to the first', () => {
    expect(stepMatch(2, 3, 1)).toBe(0);
  });

  it('wraps back from the first match to the last', () => {
    expect(stepMatch(0, 3, -1)).toBe(2);
  });

  it('stays at zero without matches', () => {
    expect(stepMatch(0, 0, 1)).toBe(0);
  });
});

describe('matchCountLabel', () => {
  it('says there are no results', () => {
    expect(matchCountLabel(0, 0, 20)).toBe('No results');
  });

  it('counts from one', () => {
    expect(matchCountLabel(1, 4, 20)).toBe('2 of 4');
  });

  it('says there are more at the limit', () => {
    expect(matchCountLabel(0, 20, 20)).toBe('1 of 20+');
  });
});
