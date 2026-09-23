import { describe, expect, it } from 'vitest';
import { diffKey, parseDiff } from './parse-diff.ts';

const textPatch =
  'diff --git a/b.txt b/b.txt\nindex b89df23..fc041de 100644\n--- a/b.txt\n+++ b/b.txt\n@@ -1,2 +1,3 @@\n b\n b2\n+b3\n';
const modePatch =
  'diff --git a/c.txt b/c.txt\nold mode 100644\nnew mode 100755\n';
const binaryPatch =
  'diff --git a/logo.png b/logo.png\nindex 1111111..2222222 100644\nBinary files a/logo.png and b/logo.png differ\n';

describe('parseDiff', () => {
  it('pairs each described file with its patch', () => {
    const output = Buffer.from(
      ':100644 100644 b89df23 0000000 M\0b.txt\0' +
        ':100644 100755 7898192 0000000 M\0c.txt\0' +
        ':100644 100644 1111111 2222222 M\0logo.png\0' +
        `\0${textPatch}${modePatch}${binaryPatch}`,
    );
    expect(Object.fromEntries(parseDiff(output))).toEqual({
      'b.txt': { kind: 'text', patch: textPatch },
      'c.txt': { kind: 'metadata-only', patch: modePatch },
      'logo.png': { kind: 'binary' },
    });
  });

  it('gives a type change both of the patches Git prints for it', () => {
    const removed = 'diff --git a/link b/link\ndeleted file mode 120000\n';
    const added = 'diff --git a/link b/link\nnew file mode 100644\n';
    const output = Buffer.from(
      `:120000 100644 1111111 0000000 T\0link\0\0${removed}${added}`,
    );
    expect(parseDiff(output).get('link')).toEqual({
      kind: 'metadata-only',
      patch: `${removed}${added}`,
    });
  });

  it('keys a rename by both of its paths', () => {
    const rename =
      'diff --git a/a.txt b/c.txt\nsimilarity index 100%\nrename from a.txt\nrename to c.txt\n';
    const output = Buffer.from(
      `:100644 100644 7898192 7898192 R100\0a.txt\0c.txt\0\0${rename}`,
    );
    expect([...parseDiff(output).keys()]).toEqual([
      diffKey(['a.txt', 'c.txt']),
    ]);
  });

  it('omits a patch that is not UTF-8 instead of mangling it', () => {
    const output = Buffer.concat([
      Buffer.from(
        ':100644 100644 b89df23 0000000 M\0b.txt\0\0diff --git a/b.txt b/b.txt\n@@ -1 +1 @@\n-',
      ),
      Buffer.from([0xff, 0x0a]),
    ]);
    expect(parseDiff(output).get('b.txt')).toEqual({
      kind: 'omitted',
      reason: 'unsupported-encoding',
    });
  });

  it('omits a single patch larger than one megabyte', () => {
    const big = `${textPatch}${'+x\n'.repeat(400_000)}`;
    const output = Buffer.from(
      `:100644 100644 b89df23 0000000 M\0b.txt\0\0${big}`,
    );
    expect(parseDiff(output).get('b.txt')).toEqual({
      kind: 'omitted',
      reason: 'size-limit',
    });
  });

  it('rejects output that describes more files than it prints', () => {
    const output = Buffer.from(
      `:100644 100644 b89df23 0000000 M\0b.txt\0:100644 100755 7898192 0000000 M\0c.txt\0\0${textPatch}`,
    );
    expect(() => parseDiff(output)).toThrow('Invalid Git diff output');
  });

  it('rejects output that prints more files than it describes', () => {
    const output = Buffer.from(
      `:100644 100644 b89df23 0000000 M\0b.txt\0\0${textPatch}${modePatch}`,
    );
    expect(() => parseDiff(output)).toThrow('Invalid Git diff output');
  });
});
