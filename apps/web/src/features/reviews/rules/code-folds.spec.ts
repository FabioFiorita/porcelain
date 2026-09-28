import { describe, expect, it } from 'vitest';
import { isFolded, parseCodeFolds, withFolds } from './code-folds.ts';

describe('parseCodeFolds', () => {
  it('reads the saved folded and expanded files', () => {
    expect(parseCodeFolds({ folded: ['a'], expanded: ['b', 'c'] })).toEqual({
      folded: ['a'],
      expanded: ['b', 'c'],
    });
  });

  it('starts with nothing folded when the saved value is not folds', () => {
    expect([
      parseCodeFolds(null),
      parseCodeFolds({ folded: ['a'] }),
      parseCodeFolds({ folded: [1], expanded: [] }),
    ]).toEqual([
      { folded: [], expanded: [] },
      { folded: [], expanded: [] },
      { folded: [], expanded: [] },
    ]);
  });
});

describe('isFolded', () => {
  it('folds a file the reader folded', () => {
    expect(isFolded({ folded: ['a'], expanded: [] }, 'a')).toBe(true);
  });

  it('folds a reviewed file until the reader expands it', () => {
    expect([
      isFolded({ folded: [], expanded: [] }, 'a', true),
      isFolded({ folded: [], expanded: ['a'] }, 'a', true),
      isFolded({ folded: [], expanded: [] }, 'a', false),
    ]).toEqual([true, false, false]);
  });
});

describe('withFolds', () => {
  it('moves the files between folded and expanded', () => {
    expect([
      withFolds({ folded: ['a'], expanded: ['b'] }, ['b', 'c'], true),
      withFolds({ folded: ['a', 'b'], expanded: [] }, ['a'], false),
    ]).toEqual([
      { folded: ['a', 'b', 'c'], expanded: [] },
      { folded: ['b'], expanded: ['a'] },
    ]);
  });
});
