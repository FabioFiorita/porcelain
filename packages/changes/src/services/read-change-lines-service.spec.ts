import { describe, expect, it } from 'vitest';
import { ReadChangeLinesService } from './read-change-lines-service.ts';
import { InMemoryChangeLinesReader } from '../../spec/fakes/in-memory-change-lines-reader.ts';

function service() {
  const files = new InMemoryChangeLinesReader();
  files.head.set('a.md', 'one\ntwo\nthree\n');
  files.worktree.set('a.md', 'one\nTWO\nthree\nfour');
  files.worktree.set(
    'long.md',
    Array.from({ length: 2500 }, (_, index) => `line ${index + 1}`).join('\n'),
  );
  return new ReadChangeLinesService(files);
}

describe('ReadChangeLinesService', () => {
  it('reads the requested lines from the chosen side', async () => {
    const read = service();
    expect(
      await read.execute({
        worktreeId: 'w',
        path: 'a.md',
        from: 2,
        to: 3,
        at: 'worktree',
      }),
    ).toEqual({
      at: 'worktree',
      path: 'a.md',
      from: 2,
      to: 3,
      lines: ['TWO', 'three'],
    });
    expect(
      (
        await read.execute({
          worktreeId: 'w',
          path: 'a.md',
          from: 2,
          to: 3,
          at: 'head',
        })
      ).lines,
    ).toEqual(['two', 'three']);
  });

  it('clamps the range to the last line and ignores the final newline', async () => {
    expect(
      await service().execute({
        worktreeId: 'w',
        path: 'a.md',
        from: 2,
        to: 9,
        at: 'head',
      }),
    ).toEqual({
      at: 'head',
      path: 'a.md',
      from: 2,
      to: 3,
      lines: ['two', 'three'],
    });
  });

  it('answers an empty range ending just before its start when it begins past the end', async () => {
    expect(
      await service().execute({
        worktreeId: 'w',
        path: 'a.md',
        from: 5,
        to: 9,
        at: 'head',
      }),
    ).toEqual({ at: 'head', path: 'a.md', from: 5, to: 4, lines: [] });
  });

  it('returns at most 2000 lines', async () => {
    const lines = await service().execute({
      worktreeId: 'w',
      path: 'long.md',
      from: 1,
      to: 2500,
      at: 'worktree',
    });
    expect([lines.to, lines.lines.length, lines.lines.at(-1)]).toEqual([
      2000,
      2000,
      'line 2000',
    ]);
  });
});
