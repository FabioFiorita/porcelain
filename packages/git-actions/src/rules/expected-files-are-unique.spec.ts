import { DuplicateExpectedFileError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { expectedFilesAreUnique } from './expected-files-are-unique.ts';

const fingerprint = 'a'.repeat(64);

describe('expectedFilesAreUnique', () => {
  it('accepts an expectation without files', () => {
    expect(() => expectedFilesAreUnique({})).not.toThrow();
  });

  it('accepts files that each name a different path', () => {
    expect(() =>
      expectedFilesAreUnique({
        files: [
          { path: 'README.md', fingerprint },
          { path: 'docs/README.md', fingerprint },
        ],
      }),
    ).not.toThrow();
  });

  it('refuses a path expected twice, even with the same fingerprint', () => {
    expect(() =>
      expectedFilesAreUnique({
        files: [
          { path: 'README.md', fingerprint },
          { path: 'README.md', fingerprint },
        ],
      }),
    ).toThrow(DuplicateExpectedFileError);
  });
});
