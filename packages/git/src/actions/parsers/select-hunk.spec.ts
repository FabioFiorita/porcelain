import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { selectHunk } from './select-hunk.ts';

const diff = fixture('diff/unified-zero.txt').toString('utf8');
const header = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n';

describe('selectHunk', () => {
  it('selects the one change the range covers exactly', () => {
    expect(selectHunk(diff, { startLine: 6, endLine: 7 })).toEqual({
      kind: 'selected',
      patch: `${header}@@ -5,0 +6,2 @@ five\n+six\n+seven\n`,
    });
  });

  it('selects a one-line change', () => {
    expect(selectHunk(diff, { startLine: 2, endLine: 2 })).toEqual({
      kind: 'selected',
      patch: `${header}@@ -2 +2 @@ one\n-two\n+TWO\n`,
    });
  });

  it('refuses a range covering only part of a change', () => {
    expect(selectHunk(diff, { startLine: 6, endLine: 6 })).toEqual({
      kind: 'partial',
    });
  });

  it('refuses a range spanning two changes', () => {
    expect(selectHunk(diff, { startLine: 2, endLine: 7 })).toEqual({
      kind: 'partial',
    });
  });

  it('finds nothing when the lines no longer hold a change', () => {
    expect(selectHunk(diff, { startLine: 3, endLine: 4 })).toEqual({
      kind: 'missing',
    });
  });

  it('finds nothing when the path has no changes left', () => {
    expect(selectHunk('', { startLine: 1, endLine: 1 })).toEqual({
      kind: 'missing',
    });
  });
});
