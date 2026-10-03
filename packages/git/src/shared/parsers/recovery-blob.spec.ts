import { describe, expect, it } from 'vitest';
import {
  discardedRef,
  parseRecoveryBlob,
  type RecoveryBlob,
  writeRecoveryBlob,
} from './recovery-blob.ts';

const hunk: RecoveryBlob = {
  id: '5b1f6c2e-0000-4000-8000-000000000001',
  path: 'src/app.ts',
  kind: 'hunk',
  cached: '',
  unstaged:
    'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -2 +2 @@\n-two\n+TWO\n',
  zero: true,
};

describe('recovery blob', () => {
  it('reads back exactly what was written for a discarded hunk', () => {
    expect(parseRecoveryBlob(writeRecoveryBlob(hunk))).toEqual(hunk);
  });

  it('reads back a discarded rename that needs no zero-context apply', () => {
    const rename: RecoveryBlob = {
      ...hunk,
      kind: 'rename',
      cached: 'diff --git a/b.txt b/c.txt\nsimilarity index 100%\n',
      zero: false,
    };
    expect(parseRecoveryBlob(writeRecoveryBlob(rename))).toEqual(rename);
  });

  it('refuses a raw patch left by an older discard', () => {
    expect(parseRecoveryBlob(hunk.unstaged)).toBe(undefined);
  });

  it('refuses JSON that is not a Porcelain recovery blob', () => {
    expect([
      parseRecoveryBlob(
        '{"porcelainDiscard":2,"id":"x","path":"a","cached":"","unstaged":""}',
      ),
      parseRecoveryBlob('{"id":"x","path":"a","cached":"","unstaged":""}'),
      parseRecoveryBlob('null'),
      parseRecoveryBlob('[1]'),
    ]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('refuses a blob whose patches or path are not text', () => {
    expect([
      parseRecoveryBlob(
        '{"porcelainDiscard":1,"id":"x","path":"a","cached":1,"unstaged":""}',
      ),
      parseRecoveryBlob(
        '{"porcelainDiscard":1,"id":"x","cached":"","unstaged":""}',
      ),
    ]).toEqual([undefined, undefined]);
  });

  it('files each discard under its own ref', () => {
    expect(discardedRef(hunk.id)).toBe(
      'refs/porcelain/discarded/5b1f6c2e-0000-4000-8000-000000000001',
    );
  });
});
