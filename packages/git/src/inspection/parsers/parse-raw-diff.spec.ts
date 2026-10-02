import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseRawDiff, parseRawDiffObjects } from './parse-raw-diff.ts';

const worktree = fixture('diff/worktree.txt');

describe('parseRawDiff', () => {
  it('reads every entry and stops where the patch starts', () => {
    const { entries, end } = parseRawDiff(worktree);
    expect(entries).toEqual([
      {
        status: 'M',
        oldMode: '100644',
        newMode: '100644',
        oldPath: 'b.txt',
        newPath: 'b.txt',
      },
      {
        status: 'M',
        oldMode: '100644',
        newMode: '100755',
        oldPath: 'c.txt',
        newPath: 'c.txt',
      },
      {
        status: 'T',
        oldMode: '120000',
        newMode: '100644',
        oldPath: 'link',
        newPath: 'link',
      },
      {
        status: 'M',
        oldMode: '100644',
        newMode: '100644',
        oldPath: 'logo.png',
        newPath: 'logo.png',
      },
    ]);
    expect(worktree.subarray(end).toString('utf8')).toMatch(
      /^diff --git a\/b\.txt b\/b\.txt\n/u,
    );
  });

  it('reads a rename with its old and new path', () => {
    expect(parseRawDiff(fixture('diff/staged-rename.txt')).entries).toEqual([
      {
        status: 'R',
        oldMode: '100644',
        newMode: '100644',
        oldPath: 'b.txt',
        newPath: 'renamed.txt',
      },
    ]);
  });

  it('reads the entries git show prints after a commit header', () => {
    const output = fixture('history/show-commit.txt');
    let header = 0;
    for (let field = 0; field < 7; field += 1)
      header = output.indexOf(0, header) + 1;
    expect(
      parseRawDiff(output, header).entries.map((entry) => entry.newPath),
    ).toEqual(['c.txt']);
  });

  it('reads full-length object names and paths with spaces', () => {
    const output = Buffer.from(
      `:000000 100644 ${'0'.repeat(40)} ${'7'.repeat(40)} A\0my file.txt\0`,
    );
    expect(parseRawDiff(output).entries).toMatchObject([
      { status: 'A', oldMode: '000000', newPath: 'my file.txt' },
    ]);
  });

  it('reads no entries from output that has none', () => {
    expect(parseRawDiff(Buffer.alloc(0))).toEqual({ entries: [], end: 0 });
  });

  it('rejects an entry cut off before its path ends', () => {
    expect(() => parseRawDiff(fixture('diff/raw-truncated.txt'))).toThrow(
      'Invalid Git diff output',
    );
  });

  it('rejects a rename missing its destination', () => {
    expect(() => parseRawDiff(fixture('diff/rename-truncated.txt'))).toThrow(
      'Invalid Git diff output',
    );
  });

  it.each([
    { name: 'a header missing a mode', meta: ':100644 b89df23 0000000 M' },
    {
      name: 'a lowercase status letter',
      meta: ':100644 100644 b89df23 0000000 m',
    },
    { name: 'a short mode', meta: ':10064 100644 b89df23 0000000 M' },
    {
      name: 'an object name that is not hexadecimal',
      meta: ':100644 100644 XYZ 0000000 M',
    },
  ])('rejects an entry header with $name', ({ meta }) => {
    expect(() => parseRawDiff(Buffer.from(`${meta}\0b.txt\0`))).toThrow(
      'Invalid Git diff output',
    );
  });

  it('rejects a path that is not valid UTF-8', () => {
    const output = Buffer.concat([
      Buffer.from(':100644 100644 b89df23 0000000 M\0'),
      Buffer.from([0xff, 0xfe, 0x00]),
    ]);
    expect(() => parseRawDiff(output)).toThrow('Invalid Git diff output');
  });
});

describe('parseRawDiffObjects', () => {
  const none = '0'.repeat(40);

  it('reads each changed file between two trees with both object names', () => {
    expect(parseRawDiffObjects(fixture('history/range-files.txt'))).toEqual([
      {
        status: 'M',
        oldMode: '100644',
        newMode: '100644',
        oldOid: '814f4a422927b82f5f8a43f8fab6d3839e3983f2',
        newOid: '4cb29ea38f70d7c61b2a3a25b02e3bdf44905402',
        oldPath: 'a.txt',
        newPath: 'a.txt',
      },
      {
        status: 'D',
        oldMode: '100644',
        newMode: '000000',
        oldOid: '286c5f5776916d7d7d5849988ca9d83e722cf9c2',
        newOid: none,
        oldPath: 'gone.txt',
        newPath: 'gone.txt',
      },
      {
        status: 'R',
        oldMode: '100644',
        newMode: '100644',
        oldOid: 'ab8e30b171f650c4aca9a3254f50d0c6c6148fb0',
        newOid: 'ab8e30b171f650c4aca9a3254f50d0c6c6148fb0',
        oldPath: 'old name.txt',
        newPath: 'new name.txt',
      },
      {
        status: 'A',
        oldMode: '000000',
        newMode: '100644',
        oldOid: none,
        newOid: '3e757656cf36eca53338e520d134963a44f793f8',
        oldPath: 'new.txt',
        newPath: 'new.txt',
      },
    ]);
  });

  it('reads no files when the trees are the same', () => {
    expect(parseRawDiffObjects(Buffer.alloc(0))).toEqual([]);
  });

  it('rejects output cut off inside a path', () => {
    expect(() =>
      parseRawDiffObjects(fixture('history/range-files-truncated.txt')),
    ).toThrow('Invalid Git diff output');
  });

  it('rejects abbreviated object names', () => {
    expect(() => parseRawDiffObjects(fixture('diff/worktree.txt'))).toThrow(
      'Invalid Git diff output',
    );
  });

  it('rejects output that continues after the last file', () => {
    expect(() =>
      parseRawDiffObjects(
        Buffer.concat([
          fixture('history/range-files.txt'),
          Buffer.from('diff --git a/a.txt b/a.txt\n'),
        ]),
      ),
    ).toThrow('Invalid Git diff output');
  });
});
