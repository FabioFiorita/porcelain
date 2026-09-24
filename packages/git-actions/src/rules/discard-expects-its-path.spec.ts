import { describe, expect, it } from 'vitest';
import { discardExpectsItsPath } from './discard-expects-its-path.ts';

const fingerprint = 'a'.repeat(64);
const discard = { action: 'discard' as const, path: 'README.md' };

describe('discardExpectsItsPath', () => {
  it('accepts exactly the discarded path', () => {
    expect(
      discardExpectsItsPath(discard, {
        files: [{ path: 'README.md', fingerprint }],
      }),
    ).toBe(true);
  });

  it('refuses a discard that expects no file', () => {
    expect(discardExpectsItsPath(discard, {})).toBe(false);
    expect(discardExpectsItsPath(discard, { files: [] })).toBe(false);
  });

  it('refuses a discard that expects another path', () => {
    expect(
      discardExpectsItsPath(discard, {
        files: [{ path: 'GUIDE.md', fingerprint }],
      }),
    ).toBe(false);
  });

  it('refuses a discard that expects a second file as well', () => {
    expect(
      discardExpectsItsPath(discard, {
        files: [
          { path: 'README.md', fingerprint },
          { path: 'GUIDE.md', fingerprint },
        ],
      }),
    ).toBe(false);
  });

  it('leaves actions other than discard alone', () => {
    expect(
      discardExpectsItsPath({ action: 'switch-branch', branch: 'main' }, {}),
    ).toBe(true);
  });
});
