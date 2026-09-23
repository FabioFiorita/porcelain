import { describe, expect, it } from 'vitest';
import { targetMatchesExpectation } from './target-matches-expectation.ts';

const readme = { path: 'README.md', fingerprint: 'a'.repeat(64) };

describe('targetMatchesExpectation', () => {
  it('matches when every expected file still has its fingerprint', () => {
    expect(
      targetMatchesExpectation(
        [readme],
        new Map([[readme.path, readme.fingerprint]]),
        false,
      ),
    ).toBe(true);
  });

  it('does not match when an expected file changed', () => {
    expect(
      targetMatchesExpectation(
        [readme],
        new Map([[readme.path, 'f'.repeat(64)]]),
        false,
      ),
    ).toBe(false);
  });

  it('does not match when an expected file is no longer a change', () => {
    expect(targetMatchesExpectation([readme], new Map(), false)).toBe(false);
  });

  it('ignores other changes when only the selected files are expected', () => {
    expect(
      targetMatchesExpectation(
        [readme],
        new Map([
          [readme.path, readme.fingerprint],
          ['GUIDE.md', 'b'.repeat(64)],
        ]),
        false,
      ),
    ).toBe(true);
  });

  it('does not match a whole change list that gained a change', () => {
    expect(
      targetMatchesExpectation(
        [readme],
        new Map([
          [readme.path, readme.fingerprint],
          ['GUIDE.md', undefined],
        ]),
        true,
      ),
    ).toBe(false);
  });

  it('matches an expected clean worktree that is still clean', () => {
    expect(targetMatchesExpectation([], new Map(), true)).toBe(true);
  });
});
