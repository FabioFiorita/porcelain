import { describe, expect, it } from 'vitest';
import type { Change, Diff } from '../../domain/review';
import {
  diffEntry,
  evidenceId,
  fileEntry,
  MAX_PARSED_DIFFS,
} from './diff-entries';

const staged: Change = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  supported: true,
};
const unstaged: Change = { ...staged, scope: 'unstaged' };

function response(
  change: Extract<Change, { kind: string }>,
  statusToken = 'a'.repeat(64),
): Diff {
  return {
    environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
    worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
    statusToken,
    consistency: 'best-effort',
    change: {
      scope: change.scope,
      oldPath: change.oldPath,
      newPath: change.newPath,
    },
    oldMode: '100644',
    newMode: '100644',
    content: {
      kind: 'text',
      patch: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
    },
  };
}

describe('continuous diff entries', () => {
  it('gives same-path staged and unstaged evidence separate identities', () => {
    expect(evidenceId(staged)).not.toBe(evidenceId(unstaged));
    expect(diffEntry(staged, response(staged))?.note).toBe('staged · modified');
    expect(diffEntry(unstaged, response(unstaged))?.note).toBe(
      'unstaged · modified',
    );
  });

  it('versions text entries from content rather than its length', () => {
    expect(fileEntry('file:a', 'a.ts', 'one').version).not.toBe(
      fileEntry('file:a', 'a.ts', 'two').version,
    );
  });

  it('rejects empty and ambiguous patches instead of silently selecting one', () => {
    const empty = response(staged);
    empty.content = { kind: 'text', patch: '' };
    expect(diffEntry(staged, empty)).toBeNull();

    const multiple = response(staged);
    multiple.content = {
      kind: 'text',
      patch:
        '--- a/one.md\n+++ b/one.md\n@@ -1 +1 @@\n-old\n+new\n--- a/two.md\n+++ b/two.md\n@@ -1 +1 @@\n-old\n+new\n',
    };
    expect(diffEntry(staged, multiple)).toBeNull();
  });

  it('evicts the oldest parsed patch when the cache reaches its bound', () => {
    const firstToken = '0'.repeat(64);
    const first = diffEntry(staged, response(staged, firstToken));
    for (let index = 1; index <= MAX_PARSED_DIFFS; index += 1) {
      const token = index.toString(16).padStart(64, '0');
      diffEntry(staged, response(staged, token));
    }

    const parsedAgain = diffEntry(staged, response(staged, firstToken));
    if (parsedAgain?.kind !== 'diff' || first?.kind !== 'diff')
      throw new Error('Expected textual patches to produce diff entries');
    expect(parsedAgain.fileDiff).not.toBe(first.fileDiff);
  });
});
