import { DiscardExpectationMismatchError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { discardExpectsItsPath } from './discard-expects-its-path.ts';

const fingerprint = 'a'.repeat(64);
const discard = { action: 'discard' as const, path: 'README.md' };

describe('discardExpectsItsPath', () => {
  it('accepts exactly the discarded path', () => {
    expect(() =>
      discardExpectsItsPath(discard, {
        files: [{ path: 'README.md', fingerprint }],
      }),
    ).not.toThrow();
  });

  it('refuses a discard that expects no file', () => {
    expect(() => discardExpectsItsPath(discard, {})).toThrow(
      DiscardExpectationMismatchError,
    );
    expect(() => discardExpectsItsPath(discard, { files: [] })).toThrow(
      DiscardExpectationMismatchError,
    );
  });

  it('refuses a discard that expects another path', () => {
    expect(() =>
      discardExpectsItsPath(discard, {
        files: [{ path: 'GUIDE.md', fingerprint }],
      }),
    ).toThrow(DiscardExpectationMismatchError);
  });

  it('refuses a discard that expects a second file as well', () => {
    expect(() =>
      discardExpectsItsPath(discard, {
        files: [
          { path: 'README.md', fingerprint },
          { path: 'GUIDE.md', fingerprint },
        ],
      }),
    ).toThrow(DiscardExpectationMismatchError);
  });
});
