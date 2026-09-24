import { describe, expect, it } from 'vitest';
import type { WorktreeEntry } from '@porcelain/changes/models';
import { ReadChangeFingerprintsService } from './read-change-fingerprints-service.ts';
import { modified } from '../../spec/fakes/comparisons.ts';
import { InMemoryWorktreeSideReader } from '../../spec/fakes/in-memory-worktree-side-reader.ts';

const limits = { maxDigestBytes: 1024 };
const comparisons = [
  modified('unstaged', 'a.md'),
  modified('unstaged', 'b.md'),
  { scope: 'untracked' as const, path: 'notes.txt' },
];

const fileA: WorktreeEntry = {
  kind: 'file',
  digest: 'a'.repeat(64),
  stamp: 'a1',
};
const fileB: WorktreeEntry = {
  kind: 'file',
  digest: 'b'.repeat(64),
  stamp: 'b1',
};

function reader(
  entries: Record<string, WorktreeEntry> = { 'a.md': fileA, 'b.md': fileB },
  stagingStamp = 'staging-1',
) {
  return new InMemoryWorktreeSideReader({ entries, stagingStamp });
}

describe('ReadChangeFingerprintsService', () => {
  it('fingerprints every change when no paths are given', async () => {
    const read = new ReadChangeFingerprintsService(reader(), limits);
    const { changes } = await read.execute({
      worktreeId: 'w',
      comparisons,
      paths: undefined,
    });
    expect(
      changes.map((change) => [change.path, typeof change.fingerprint]),
    ).toEqual([
      ['a.md', 'string'],
      ['b.md', 'string'],
      ['notes.txt', 'undefined'],
    ]);
  });

  it('fingerprints only the requested paths', async () => {
    const read = new ReadChangeFingerprintsService(reader(), limits);
    const { changes } = await read.execute({
      worktreeId: 'w',
      comparisons,
      paths: ['b.md'],
    });
    expect(changes.map((change) => change.path)).toEqual(['b.md']);
  });

  it('gives a different stamp once a read file or the staging area is touched', async () => {
    const request = { worktreeId: 'w', comparisons, paths: ['a.md'] };
    const first = await new ReadChangeFingerprintsService(
      reader(),
      limits,
    ).execute(request);
    const staged = await new ReadChangeFingerprintsService(
      reader(undefined, 'staging-2'),
      limits,
    ).execute(request);
    const touched = await new ReadChangeFingerprintsService(
      reader({ 'a.md': { ...fileA, stamp: 'a2' }, 'b.md': fileB }, 'staging-2'),
      limits,
    ).execute(request);
    expect(new Set([first.stamp, staged.stamp, touched.stamp]).size).toBe(3);
  });

  it('keeps the stamp when nothing it read was touched', async () => {
    const request = { worktreeId: 'w', comparisons, paths: ['a.md'] };
    const before = await new ReadChangeFingerprintsService(
      reader(),
      limits,
    ).execute(request);
    const after = await new ReadChangeFingerprintsService(
      reader({
        'a.md': fileA,
        'b.md': { kind: 'file', digest: 'c'.repeat(64), stamp: 'b2' },
      }),
      limits,
    ).execute(request);
    expect(after.stamp).toBe(before.stamp);
  });
});
