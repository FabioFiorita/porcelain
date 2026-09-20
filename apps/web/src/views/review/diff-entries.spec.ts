import { describe, expect, it } from 'vitest';
import type { Change, CommitChanges, DiffContent } from '../../domain/review';
import { changeId, commitEntry, diffEntry, fileEntry } from './diff-entries';

const staged = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  oldOid: 'a'.repeat(40),
  newOid: 'b'.repeat(40),
  supported: true,
} satisfies Change;
const unstaged = { ...staged, scope: 'unstaged' as const };

function patch(): DiffContent {
  return {
    kind: 'text',
    patch: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
  };
}

describe('continuous diff entries', () => {
  it('gives same-path staged and unstaged changes separate identities', () => {
    expect(changeId(staged)).not.toBe(changeId(unstaged));
    expect(diffEntry(staged, patch())?.note).toBe('staged · modified');
    expect(diffEntry(unstaged, patch())?.note).toBe('unstaged · modified');
  });

  it('versions text entries from content rather than its length', () => {
    expect(fileEntry('file:a', 'a.ts', 'one').version).not.toBe(
      fileEntry('file:a', 'a.ts', 'two').version,
    );
  });

  it('rejects empty and ambiguous patches instead of silently selecting one', () => {
    expect(diffEntry(staged, { kind: 'text', patch: '' })).toBeNull();
    expect(
      diffEntry(staged, {
        kind: 'text',
        patch:
          '--- a/one.md\n+++ b/one.md\n@@ -1 +1 @@\n-old\n+new\n--- a/two.md\n+++ b/two.md\n@@ -1 +1 @@\n-old\n+new\n',
      }),
    ).toBeNull();
  });

  it('turns a commit patch into the shared Pierre entry shape', () => {
    const change: CommitChanges['changes'][number] = {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified',
      oldMode: '100644',
      newMode: '100644',
      patch: {
        kind: 'text',
        text: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      },
    };

    expect(commitEntry('b'.repeat(40), change)).toMatchObject({
      id: `commit:${'b'.repeat(40)}:README.md`,
      kind: 'diff',
      path: 'README.md',
      note: 'modified',
    });
  });

  it('uses distinct Pierre cache identities for different parent patches', () => {
    const base: CommitChanges['changes'][number] = {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified',
      oldMode: '100644',
      newMode: '100644',
      patch: {
        kind: 'text',
        text: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+first\n',
      },
    };
    const first = commitEntry('b'.repeat(40), base);
    const second = commitEntry('b'.repeat(40), {
      ...base,
      patch: {
        kind: 'text',
        text: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+second\n',
      },
    });

    if (first?.kind !== 'diff' || second?.kind !== 'diff')
      throw new Error('Expected textual patches to produce diff entries');
    expect(first.fileDiff.cacheKey).not.toBe(second.fileDiff.cacheKey);
  });

  /**
   * The query keeps the content object it parsed across renders and across a
   * refetch that answered the same bytes, so a document that is re-rendered
   * does not re-parse its patch. A different object is different content.
   */
  it('parses a patch once for the same content object', () => {
    const content = patch();
    const parsed = diffEntry(staged, content);
    const again = diffEntry(staged, content);
    const other = diffEntry(staged, patch());

    if (
      parsed?.kind !== 'diff' ||
      again?.kind !== 'diff' ||
      other?.kind !== 'diff'
    )
      throw new Error('Expected textual patches to produce diff entries');
    expect(again.fileDiff).toBe(parsed.fileDiff);
    expect(other.fileDiff).not.toBe(parsed.fileDiff);
  });
});
