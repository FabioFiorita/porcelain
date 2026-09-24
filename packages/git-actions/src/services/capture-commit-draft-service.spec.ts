import {
  CommitDraftSelectionError,
  CommitDraftTooLargeError,
} from '@porcelain/git-actions/errors';
import type {
  CommitDraftObservation,
  UntrackedFileRead,
} from '@porcelain/git-actions/models';
import type { FileChange } from '@porcelain/kernel/models';
import { describe, expect, it } from 'vitest';
import {
  GUIDE_FINGERPRINT,
  HEAD_OID,
  README_FINGERPRINT,
  WORKTREE_ID,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemorySelectedDiffReader } from '../../spec/fakes/in-memory-selected-diff-reader.ts';
import { InMemoryUntrackedFileReader } from '../../spec/fakes/in-memory-untracked-file-reader.ts';
import { CaptureCommitDraftService } from './capture-commit-draft-service.ts';

const limits = {
  maxComparisons: 3,
  maxEvidenceBytes: 4096,
  maxUntrackedBytes: 1024,
};
const modified = (path: string, fingerprint: string): FileChange => ({
  path,
  fingerprint,
  comparisons: [
    {
      scope: 'unstaged',
      kind: 'modified',
      oldPath: path,
      newPath: path,
      oldMode: '100644',
      newMode: '100644',
      oldOid: '2'.repeat(40),
      newOid: undefined,
      supported: true,
    },
  ],
});
const renamed: FileChange = {
  path: 'GUIDE.md',
  fingerprint: GUIDE_FINGERPRINT,
  comparisons: [
    {
      scope: 'staged',
      kind: 'renamed',
      oldPath: 'OLD.md',
      newPath: 'GUIDE.md',
      oldMode: '100644',
      newMode: '100644',
      oldOid: '3'.repeat(40),
      newOid: '3'.repeat(40),
      supported: true,
    },
  ],
};
const untracked: FileChange = {
  path: 'notes.md',
  fingerprint: '4'.repeat(64),
  comparisons: [{ scope: 'untracked', path: 'notes.md' }],
};
const observed = (...changes: FileChange[]): CommitDraftObservation => ({
  headOid: HEAD_OID,
  changes,
});
const input = (observation: CommitDraftObservation, ...paths: string[]) => ({
  worktreeId: WORKTREE_ID,
  observation,
  paths,
});

function evidence(text: string): unknown {
  return JSON.parse(text);
}

function service(
  patches: Record<string, string> = {},
  files: Record<string, UntrackedFileRead> = {},
  options = limits,
) {
  return new CaptureCommitDraftService(
    new InMemorySelectedDiffReader(patches),
    new InMemoryUntrackedFileReader(files),
    options,
  );
}

describe('CaptureCommitDraftService', () => {
  it('captures the selected change once, with its diff and fingerprint', async () => {
    const capture = await service({
      'README.md': 'diff --git a/README.md b/README.md',
    }).execute(
      input(
        observed(
          modified('README.md', README_FINGERPRINT),
          modified('OTHER.md', GUIDE_FINGERPRINT),
        ),
        'README.md',
        'README.md',
      ),
    );
    expect(capture.paths).toEqual(['README.md']);
    expect(capture.bundles).toEqual([['README.md']]);
    expect(capture.expectedFiles).toEqual([
      { path: 'README.md', fingerprint: README_FINGERPRINT },
    ]);
    expect(evidence(capture.evidence)).toMatchObject({
      patch: 'diff --git a/README.md b/README.md',
    });
  });

  it('refuses a path that is not a change', async () => {
    await expect(
      service().execute(
        input(
          observed(modified('README.md', README_FINGERPRINT)),
          'missing.md',
        ),
      ),
    ).rejects.toThrow(CommitDraftSelectionError);
  });

  it('refuses a change it cannot fingerprint', async () => {
    await expect(
      service().execute(
        input(
          observed({
            ...modified('README.md', README_FINGERPRINT),
            fingerprint: undefined,
          }),
          'README.md',
        ),
      ),
    ).rejects.toThrow(CommitDraftSelectionError);
  });

  it('keeps both sides of a selected rename in one bundle and diffs both', async () => {
    const capture = await service({
      'GUIDE.md': '+new side',
      'OLD.md': '-old side',
    }).execute(input(observed(renamed), 'GUIDE.md', 'OLD.md'));
    expect(capture.bundles).toEqual([['GUIDE.md', 'OLD.md']]);
    expect(evidence(capture.evidence)).toMatchObject({
      patch: '+new side-old side',
    });
  });

  it('reads an untracked file as content instead of a diff', async () => {
    const capture = await service(
      { 'notes.md': 'never diffed' },
      { 'notes.md': { kind: 'text', text: 'hello', byteLength: 5 } },
    ).execute(input(observed(untracked), 'notes.md'));
    expect(evidence(capture.evidence)).toMatchObject({
      patch: '',
      untracked: {
        'notes.md': {
          kind: 'file',
          worktreeId: WORKTREE_ID,
          path: 'notes.md',
          encoding: 'utf-8',
          byteLength: 5,
          text: 'hello',
        },
      },
    });
  });

  it('names why an untracked file was left out of the evidence', async () => {
    const tooLarge = await service(
      {},
      { 'notes.md': { kind: 'too-large' } },
    ).execute(input(observed(untracked), 'notes.md'));
    const unreadable = await service(
      {},
      { 'notes.md': { kind: 'failed', failure: 'unsupported-text' } },
    ).execute(input(observed(untracked), 'notes.md'));
    expect(evidence(tooLarge.evidence)).toMatchObject({
      untracked: { 'notes.md': { kind: 'omitted', reason: 'too-large' } },
    });
    expect(evidence(unreadable.evidence)).toMatchObject({
      untracked: {
        'notes.md': { kind: 'omitted', reason: 'unsupported-text' },
      },
    });
  });

  it('accepts as many compared changes as the limit and refuses one more', async () => {
    const changes = Array.from({ length: 4 }, (_, index) =>
      modified(`file-${index}.md`, README_FINGERPRINT),
    );
    const paths = changes.map((change) => change.path);
    await expect(
      service().execute(input(observed(...changes), ...paths.slice(0, 3))),
    ).resolves.toMatchObject({ paths: paths.slice(0, 3) });
    await expect(
      service().execute(input(observed(...changes), ...paths)),
    ).rejects.toThrow(CommitDraftTooLargeError);
  });

  it('refuses evidence larger than its limit', async () => {
    await expect(
      service({ 'README.md': 'x'.repeat(4096) }).execute(
        input(observed(modified('README.md', README_FINGERPRINT)), 'README.md'),
      ),
    ).rejects.toThrow(CommitDraftTooLargeError);
  });
});
