import { describe, expect, it } from 'vitest';
import { ReadChangeFingerprintsService } from './read-change-fingerprints-service.ts';
import { modified } from '../../spec/fakes/comparisons.ts';
import { InMemoryWorktreeSideReader } from '../../spec/fakes/in-memory-worktree-side-reader.ts';

const limits = { maxDigestBytes: 1024 };
const comparisons = [
  modified('unstaged', 'a.md'),
  modified('unstaged', 'b.md'),
  { scope: 'untracked' as const, path: 'notes.txt' },
];

function reader() {
  const sides = new InMemoryWorktreeSideReader();
  sides.entries.set('a.md', {
    kind: 'file',
    digest: 'a'.repeat(64),
    stamp: 'a1',
  });
  sides.entries.set('b.md', {
    kind: 'file',
    digest: 'b'.repeat(64),
    stamp: 'b1',
  });
  return sides;
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
    const sides = reader();
    const read = new ReadChangeFingerprintsService(sides, limits);
    const request = { worktreeId: 'w', comparisons, paths: ['a.md'] };
    const first = await read.execute(request);
    sides.stagingStamp = 'staging-2';
    const staged = await read.execute(request);
    sides.entries.set('a.md', {
      kind: 'file',
      digest: 'a'.repeat(64),
      stamp: 'a2',
    });
    const touched = await read.execute(request);
    expect(new Set([first.stamp, staged.stamp, touched.stamp]).size).toBe(3);
  });

  it('keeps the stamp when nothing it read was touched', async () => {
    const sides = reader();
    const read = new ReadChangeFingerprintsService(sides, limits);
    const request = { worktreeId: 'w', comparisons, paths: ['a.md'] };
    sides.entries.set('b.md', {
      kind: 'file',
      digest: 'c'.repeat(64),
      stamp: 'b2',
    });
    expect((await read.execute(request)).stamp).toBe(
      (await read.execute(request)).stamp,
    );
  });
});
