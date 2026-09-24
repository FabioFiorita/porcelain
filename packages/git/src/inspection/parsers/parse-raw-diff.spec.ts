import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseRawDiff } from './parse-raw-diff.ts';

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

  it('rejects a malformed entry header', () => {
    for (const meta of [
      ':100644 b89df23 0000000 M',
      ':100644 100644 b89df23 0000000 m',
      ':10064 100644 b89df23 0000000 M',
      ':100644 100644 XYZ 0000000 M',
    ])
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
