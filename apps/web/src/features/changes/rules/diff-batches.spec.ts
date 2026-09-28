import { describe, expect, it } from 'vitest';
import { diffBatches } from './diff-batches.ts';

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
      indexes.map(file).toReversed(),
      indexes.map(unstaged).toReversed(),
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
