import { describe, expect, it } from 'vitest';
import { modified } from '../../spec/fixtures/comparisons.ts';
import { assembleChanges } from './assemble-changes.ts';

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
});
