import { describe, expect, it } from 'vitest';
import { expectationHolds } from './expectation-holds.ts';

const readme = { path: 'README.md', fingerprint: 'a'.repeat(64) };

describe('expectationHolds', () => {
  it('holds when every expected file still has its fingerprint', () => {
    expect(
      expectationHolds(
        [readme],
        new Map([
          [readme.path, readme.fingerprint],
          ['GUIDE.md', 'b'.repeat(64)],
        ]),
      ),
    ).toBe(true);
  });

  it('fails when one expected file has another fingerprint', () => {
    expect(
      expectationHolds(
        [readme, { path: 'GUIDE.md', fingerprint: 'b'.repeat(64) }],
        new Map([
          [readme.path, readme.fingerprint],
          ['GUIDE.md', 'c'.repeat(64)],
        ]),
      ),
    ).toBe(false);
  });

  it('fails when an expected file is gone or lost its fingerprint', () => {
    expect(expectationHolds([readme], new Map())).toBe(false);
    expect(
      expectationHolds([readme], new Map([[readme.path, undefined]])),
    ).toBe(false);
  });

  it('holds for an expectation of nothing', () => {
    expect(expectationHolds([], new Map([['GUIDE.md', 'b'.repeat(64)]]))).toBe(
      true,
    );
  });
});
