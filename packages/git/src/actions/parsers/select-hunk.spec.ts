import { describe, expect, it } from 'vitest';
import { selectHunk } from './select-hunk.ts';

const header =
  'diff --git a/a.txt b/a.txt\nindex 4cb29ea..ddc897f 100644\n--- a/a.txt\n+++ b/a.txt\n';
const first = '@@ -2 +2 @@\n-two\n+TWO\n';
const second = '@@ -5,0 +6,2 @@\n+six\n+seven\n';
const diff = `${header}${first}${second}`;
const patchHeader = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n';

describe('selectHunk', () => {
  it('selects the one change the range covers exactly', () => {
    expect(selectHunk(diff, { startLine: 6, endLine: 7 })).toEqual({
      kind: 'selected',
      patch: `${patchHeader}${second}`,
    });
  });

  it('selects a one-line change', () => {
    expect(selectHunk(diff, { startLine: 2, endLine: 2 })).toEqual({
      kind: 'selected',
      patch: `${patchHeader}${first}`,
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
    expect([
      selectHunk(diff, { startLine: 3, endLine: 4 }),
      selectHunk('', { startLine: 1, endLine: 1 }),
    ]).toEqual([{ kind: 'missing' }, { kind: 'missing' }]);
  });
});
