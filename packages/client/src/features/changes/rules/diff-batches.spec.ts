import { describe, expect, it } from 'vitest';
import { consecutiveBatches, diffBatches } from './diff-batches.ts';

const name = (index: number) => `file-${String(index).padStart(4, '0')}.md`;
const file = (index: number) => ({ path: name(index), fingerprint: 'print' });
const unstaged = (index: number) => ({
  scope: 'unstaged' as const,
  oldPath: name(index),
  newPath: name(index),
});
const staged = (index: number) => ({
  ...unstaged(index),
  scope: 'staged' as const,
});
const limit = 4;
const range = (count: number) => Array.from({ length: count }, (_, at) => at);

describe('diffBatches', () => {
  it('orders grouped selections without requiring native copy-on-sort arrays', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      'toSorted',
    );
    const expectedFiles = [{ path: 'sample.ts', fingerprint: 'current' }];
    const selections = [
      {
        scope: 'unstaged' as const,
        oldPath: 'sample.ts',
        newPath: 'sample.ts',
      },
      { scope: 'staged' as const, oldPath: 'sample.ts', newPath: 'sample.ts' },
    ];
    try {
      Reflect.deleteProperty(Array.prototype, 'toSorted');
      expect(Reflect.get(Array.prototype, 'toSorted')).toBeUndefined();
      expect(() => diffBatches(expectedFiles, selections, limit)).not.toThrow();
      expect(diffBatches(expectedFiles, selections, limit)).toEqual([
        {
          expectedFiles: [{ path: 'sample.ts', fingerprint: 'current' }],
          selections: [
            { scope: 'staged', oldPath: 'sample.ts', newPath: 'sample.ts' },
            { scope: 'unstaged', oldPath: 'sample.ts', newPath: 'sample.ts' },
          ],
        },
      ]);
      expect(selections).toEqual([
        { scope: 'unstaged', oldPath: 'sample.ts', newPath: 'sample.ts' },
        { scope: 'staged', oldPath: 'sample.ts', newPath: 'sample.ts' },
      ]);
      expect(expectedFiles).toEqual([
        { path: 'sample.ts', fingerprint: 'current' },
      ]);
    } finally {
      if (descriptor)
        Object.defineProperty(Array.prototype, 'toSorted', descriptor);
    }
  });

  it('asks for nothing when no diff is wanted', () => {
    expect(diffBatches([file(0)], [], limit)).toEqual([]);
  });

  it('keeps up to the request limit in one request', () => {
    const indexes = range(limit);
    expect(
      diffBatches(indexes.map(file), indexes.map(unstaged), limit).map(
        (batch) => batch.selections.length,
      ),
    ).toEqual([limit]);
  });

  it('splits one past the limit into requests in path order, each with the files it selects', () => {
    const indexes = range(limit + 1);
    const batches = diffBatches(
      indexes.map(file).reverse(),
      indexes.map(unstaged).reverse(),
      limit,
    );
    expect(
      batches.map((batch) => ({
        files: batch.expectedFiles.map((entry) => entry.path),
        selected: batch.selections.map((selection) => selection.newPath),
      })),
    ).toEqual([
      {
        files: range(limit).map(name),
        selected: range(limit).map(name),
      },
      {
        files: [name(limit)],
        selected: [name(limit)],
      },
    ]);
  });

  it('never splits the staged and unstaged diffs of one file across requests', () => {
    const indexes = range(limit / 2 + 1);
    const batches = diffBatches(
      indexes.map(file),
      [...indexes.map(unstaged), ...indexes.map(staged)],
      limit,
    );
    expect(
      batches.map((batch) => [
        batch.expectedFiles.length,
        batch.selections.length,
      ]),
    ).toEqual([
      [limit / 2, limit],
      [1, 2],
    ]);
  });

  it('files a rename under its new path', () => {
    const rename = {
      scope: 'staged' as const,
      oldPath: 'old.md',
      newPath: 'new.md',
    };
    expect(
      diffBatches([{ path: 'new.md', fingerprint: 'print' }], [rename], limit),
    ).toEqual([
      {
        expectedFiles: [{ path: 'new.md', fingerprint: 'print' }],
        selections: [rename],
      },
    ]);
  });
});

describe('consecutiveBatches', () => {
  it('splits the files shown so far into batches of the window size', () => {
    expect(consecutiveBatches(range(7), 3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6],
    ]);
  });

  it('keeps every earlier batch as it was when more files are shown', () => {
    const before = consecutiveBatches(range(3), 3);
    const after = consecutiveBatches(range(5), 3);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('reads nothing when nothing is shown', () => {
    expect(consecutiveBatches([], 3)).toEqual([]);
  });
});
