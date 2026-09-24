import { describe, expect, it } from 'vitest';
import { expectedFilesAreUnique } from './expected-files-are-unique.ts';

const fingerprint = 'a'.repeat(64);

describe('expectedFilesAreUnique', () => {
  it('accepts an expectation without files', () => {
    expect(expectedFilesAreUnique({})).toBe(true);
  });

  it('accepts files that each name a different path', () => {
    expect(
      expectedFilesAreUnique({
        files: [
          { path: 'README.md', fingerprint },
          { path: 'docs/README.md', fingerprint },
        ],
      }),
    ).toBe(true);
  });

  it('refuses a path expected twice, even with the same fingerprint', () => {
    expect(
      expectedFilesAreUnique({
        files: [
          { path: 'README.md', fingerprint },
          { path: 'README.md', fingerprint },
        ],
      }),
    ).toBe(false);
  });
});
