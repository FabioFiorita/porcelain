import {
  CommitDraftSelectionError,
  CommitDraftTooLargeError,
  CommitDraftUnavailableError,
  WorktreeChangedError,
} from '@porcelain/git-actions/errors';
import type {
  CommitDraftChange,
  CommitDraftObservation,
} from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import {
  guideFingerprint,
  headOid,
  projectId,
  readmeFingerprint,
  worktreeId,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryCommitDraftReader } from '../../spec/fakes/in-memory-commit-draft-reader.ts';
import { CaptureCommitDraftService } from './capture-commit-draft-service.ts';

const statusToken = '1'.repeat(64);
const modified = (path: string, fingerprint: string): CommitDraftChange => ({
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
const renamed: CommitDraftChange = {
  path: 'GUIDE.md',
  fingerprint: guideFingerprint,
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
const untracked: CommitDraftChange = {
  path: 'notes.md',
  fingerprint: '4'.repeat(64),
  comparisons: [{ scope: 'untracked', path: 'notes.md' }],
};
const observed = (...changes: CommitDraftChange[]): CommitDraftObservation => ({
  statusToken,
  headOid,
  changes,
});
const input = (...paths: string[]) => ({
  projectId,
  worktreeId,
  expectedStatusToken: statusToken,
  paths,
});

describe('CaptureCommitDraftService', () => {
  it('captures the selected change with its diff and confirms the worktree held still', async () => {
    const reader = new InMemoryCommitDraftReader(
      observed(modified('README.md', readmeFingerprint)),
      'diff --git a/README.md b/README.md',
    );
    const capture = await new CaptureCommitDraftService(reader).execute(
      input('README.md', 'README.md'),
    );
    expect(capture.paths).toEqual(['README.md']);
    expect(capture.bundles).toEqual([['README.md']]);
    expect(capture.expectedFiles).toEqual([
      { path: 'README.md', fingerprint: readmeFingerprint },
    ]);
    expect(capture.evidence).toContain('diff --git a/README.md b/README.md');
    expect(reader.confirmed).toBe(1);
  });

  it('refuses when the status moved since the client looked', async () => {
    const reader = new InMemoryCommitDraftReader({
      ...observed(modified('README.md', readmeFingerprint)),
      statusToken: '5'.repeat(64),
    });
    await expect(
      new CaptureCommitDraftService(reader).execute(input('README.md')),
    ).rejects.toThrow(WorktreeChangedError);
  });

  it('refuses a path that is not a change', async () => {
    const reader = new InMemoryCommitDraftReader(
      observed(modified('README.md', readmeFingerprint)),
    );
    await expect(
      new CaptureCommitDraftService(reader).execute(input('missing.md')),
    ).rejects.toThrow(CommitDraftSelectionError);
  });

  it('refuses a change it cannot fingerprint', async () => {
    const reader = new InMemoryCommitDraftReader(
      observed({
        ...modified('README.md', readmeFingerprint),
        fingerprint: undefined,
      }),
    );
    await expect(
      new CaptureCommitDraftService(reader).execute(input('README.md')),
    ).rejects.toThrow(CommitDraftSelectionError);
  });

  it('keeps both sides of a selected rename in one bundle', async () => {
    const reader = new InMemoryCommitDraftReader(observed(renamed), 'patch');
    const capture = await new CaptureCommitDraftService(reader).execute(
      input('GUIDE.md', 'OLD.md'),
    );
    expect(capture.bundles).toEqual([['GUIDE.md', 'OLD.md']]);
    expect(reader.diffRequests).toEqual([['GUIDE.md', 'OLD.md']]);
  });

  it('reads untracked files as content instead of a diff', async () => {
    const reader = new InMemoryCommitDraftReader(observed(untracked), '', {
      'notes.md': {
        kind: 'file',
        worktreeId,
        path: 'notes.md',
        encoding: 'utf-8',
        byteLength: 5,
        text: 'hello',
      },
    });
    const capture = await new CaptureCommitDraftService(reader).execute(
      input('notes.md'),
    );
    expect(reader.diffRequests).toEqual([]);
    expect(capture.evidence).toContain('"text":"hello"');
  });

  it('refuses when Git cannot produce the selected diff', async () => {
    const reader = new InMemoryCommitDraftReader(
      observed(modified('README.md', readmeFingerprint)),
      false,
    );
    await expect(
      new CaptureCommitDraftService(reader).execute(input('README.md')),
    ).rejects.toThrow(CommitDraftUnavailableError);
  });

  it('refuses a selection with more comparisons than a draft can hold', async () => {
    const changes = Array.from({ length: 201 }, (_, index) =>
      modified(`file-${index}.md`, readmeFingerprint),
    );
    const reader = new InMemoryCommitDraftReader(observed(...changes));
    await expect(
      new CaptureCommitDraftService(reader).execute(
        input(...changes.map((change) => change.path)),
      ),
    ).rejects.toThrow(CommitDraftTooLargeError);
    expect(reader.diffRequests).toEqual([]);
  });

  it('refuses evidence larger than one mebibyte before confirming', async () => {
    const reader = new InMemoryCommitDraftReader(
      observed(modified('README.md', readmeFingerprint)),
      'x'.repeat(1024 * 1024),
    );
    await expect(
      new CaptureCommitDraftService(reader).execute(input('README.md')),
    ).rejects.toThrow(CommitDraftTooLargeError);
    expect(reader.confirmed).toBe(0);
  });
});
