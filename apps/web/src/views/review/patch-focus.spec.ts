import { parsePatchFiles } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { contextPatch, focusPatch } from './patch-focus';

describe('step code ranges', () => {
  it('preserves real old and new line offsets when cutting a replacement', () => {
    const patch =
      'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -10,5 +10,5 @@\n before\n-old\n+new\n middle\n after\n end\n';
    const focused = focusPatch(patch, [{ startLine: 11, endLine: 11 }], 0);
    expect(focused).toContain('@@ -11,1 +11,1 @@\n-old\n+new');
    expect(focused).not.toContain(' before');
    expect(parsePatchFiles(focused ?? '')[0]?.files).toHaveLength(1);
    expect(focusPatch(patch, [{ startLine: 100, endLine: 101 }])).toBeNull();
  });
  it('retains an end-of-file marker with its selected line', () => {
    const patch =
      'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file\n';
    expect(focusPatch(patch, [{ startLine: 1, endLine: 1 }], 0)).toContain(
      '+new\n\\ No newline at end of file',
    );
  });
  it('quotes special file paths and numbers context from the source location', () => {
    const patch = contextPatch('a\n"quoted.ts', 42, ['first', 'second']);
    expect(patch).toContain('@@ -42,2 +42,2 @@\n first\n second');
    expect(patch).toContain('+++ "b/a\\n\\"quoted.ts"');
    expect(parsePatchFiles(patch)[0]?.files).toHaveLength(1);
  });
});
