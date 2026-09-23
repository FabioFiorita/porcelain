import { describe, expect, it } from 'vitest';
import { parseRawDiff } from './parse-raw-diff.ts';

const modified = ':100644 100644 b89df23 0000000 M\0b.txt\0';
const renamed = ':100644 100644 7898192 7898192 R100\0a.txt\0c.txt\0';
const patch =
  'diff --git a/b.txt b/b.txt\nindex b89df23..fc041de 100644\n--- a/b.txt\n+++ b/b.txt\n@@ -1,2 +1,3 @@\n b\n b2\n+b3\n';

describe('parseRawDiff', () => {
  it('reads modified and renamed entries and stops where the patch starts', () => {
    const output = Buffer.from(`${modified}${renamed}\0${patch}`);
    const { entries, end } = parseRawDiff(output);
    expect(entries).toEqual([
      {
        status: 'M',
        oldMode: '100644',
        newMode: '100644',
        oldPath: 'b.txt',
        newPath: 'b.txt',
      },
      {
        status: 'R',
        oldMode: '100644',
        newMode: '100644',
        oldPath: 'a.txt',
        newPath: 'c.txt',
      },
    ]);
    expect(output.subarray(end).toString('utf8')).toBe(patch);
  });

  it('reads the entries git show prints after a commit header', () => {
    const header = 'subject\0body\n\0';
    const output = Buffer.from(`${header}\n${modified}`);
    expect(
      parseRawDiff(output, Buffer.byteLength(header)).entries.map(
        (entry) => entry.newPath,
      ),
    ).toEqual(['b.txt']);
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
    expect(() =>
      parseRawDiff(Buffer.from(':100644 100644 b89df23 0000000 M\0b.t')),
    ).toThrow('Invalid Git diff output');
  });

  it('rejects a rename missing its destination', () => {
    expect(() =>
      parseRawDiff(Buffer.from(':100644 100644 7898192 7898192 R100\0a.txt')),
    ).toThrow('Invalid Git diff output');
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
