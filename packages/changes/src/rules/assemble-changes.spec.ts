import { describe, expect, it } from 'vitest';
import { assembleChanges } from './assemble-changes.ts';
import { modified } from '../../spec/fixtures/comparisons.ts';

describe('assembleChanges', () => {
  it('groups every comparison of a path into one change, staged before unstaged', () => {
    const changes = assembleChanges(
      [
        modified('unstaged', 'README.md'),
        modified('staged', 'README.md', '1'.repeat(40)),
      ],
      new Map([['README.md', { digest: 'd'.repeat(64) }]]),
    );
    expect(changes.map((change) => change.path)).toEqual(['README.md']);
    expect(changes[0]?.comparisons.map((entry) => entry.scope)).toEqual([
      'staged',
      'unstaged',
    ]);
    expect(changes[0]?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lists paths in locale order regardless of case', () => {
    const changes = assembleChanges(
      [
        { scope: 'untracked', path: 'notes.txt' },
        modified('staged', 'README.md', '1'.repeat(40)),
        { scope: 'untracked', path: 'alpha.txt' },
      ],
      new Map([
        ['notes.txt', { digest: 'a'.repeat(64) }],
        ['alpha.txt', { digest: 'b'.repeat(64) }],
      ]),
    );
    expect(changes.map((change) => change.path)).toEqual([
      'alpha.txt',
      'notes.txt',
      'README.md',
    ]);
  });

  it('files a rename under its new path', () => {
    const changes = assembleChanges(
      [
        {
          ...modified('staged', 'GUIDE.md', '1'.repeat(40)),
          kind: 'renamed',
          oldPath: 'README.md',
        },
      ],
      new Map(),
    );
    expect(changes.map((change) => change.path)).toEqual(['GUIDE.md']);
  });

  it('returns no changes for a clean worktree, and one change for a single new file', () => {
    expect(assembleChanges([], new Map())).toEqual([]);
    expect(
      assembleChanges(
        [{ scope: 'untracked', path: 'notes.txt' }],
        new Map([['notes.txt', { digest: 'a'.repeat(64) }]]),
      ),
    ).toEqual([
      {
        path: 'notes.txt',
        fingerprint:
          '2184df0682ff5423d787fbf23a64e6754a677cbad6ce0bead382101f42358f8c',
        comparisons: [{ scope: 'untracked', path: 'notes.txt' }],
      },
    ]);
  });
});
