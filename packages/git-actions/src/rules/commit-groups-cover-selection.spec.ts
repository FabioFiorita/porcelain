import { CommitGroupsMismatchError } from '@porcelain/git-actions/errors';
import type { CommitDraftCapture } from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import { commitGroupsCoverSelection } from './commit-groups-cover-selection.ts';

const capture: CommitDraftCapture = {
  paths: ['old.md', 'new.md', 'README.md'],
  bundles: [['old.md', 'new.md'], ['README.md']],
  evidence: '{}',
  expectedFiles: [],
};
const group = (message: string, ...paths: string[]) => ({ message, paths });

describe('commitGroupsCoverSelection', () => {
  it('accepts groups that use every selected path once and keep a rename together', () => {
    expect(() =>
      commitGroupsCoverSelection(
        [group('Rename', 'old.md', 'new.md'), group('Docs', 'README.md')],
        capture,
        'groups',
      ),
    ).not.toThrow();
  });

  it('accepts one message covering everything in message mode', () => {
    expect(() =>
      commitGroupsCoverSelection(
        [group('All', 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
      ),
    ).not.toThrow();
  });

  it('refuses several groups in message mode', () => {
    expect(() =>
      commitGroupsCoverSelection(
        [group('Rename', 'old.md', 'new.md'), group('Docs', 'README.md')],
        capture,
        'message',
      ),
    ).toThrow(CommitGroupsMismatchError);
  });

  it('refuses a rename split across groups', () => {
    expect(() =>
      commitGroupsCoverSelection(
        [group('Old', 'old.md', 'README.md'), group('New', 'new.md')],
        capture,
        'groups',
      ),
    ).toThrow(CommitGroupsMismatchError);
  });

  it('refuses a missing, repeated or unknown path', () => {
    for (const groups of [
      [group('Rename', 'old.md', 'new.md')],
      [group('All', 'old.md', 'new.md', 'README.md', 'README.md')],
      [group('All', 'old.md', 'new.md', 'GUIDE.md')],
    ])
      expect(() =>
        commitGroupsCoverSelection(groups, capture, 'groups'),
      ).toThrow(CommitGroupsMismatchError);
  });

  it('refuses no groups, an empty group and more than twenty groups', () => {
    const single: CommitDraftCapture = {
      ...capture,
      paths: ['README.md'],
      bundles: [['README.md']],
    };
    expect(() => commitGroupsCoverSelection([], single, 'groups')).toThrow(
      CommitGroupsMismatchError,
    );
    expect(() =>
      commitGroupsCoverSelection(
        [group('Docs', 'README.md'), group('Nothing')],
        single,
        'groups',
      ),
    ).toThrow(CommitGroupsMismatchError);
    const many = Array.from({ length: 21 }, (_, index) => `${index}.md`);
    expect(() =>
      commitGroupsCoverSelection(
        many.map((path) => group(path, path)),
        { ...capture, paths: many, bundles: many.map((path) => [path]) },
        'groups',
      ),
    ).toThrow(CommitGroupsMismatchError);
  });

  it('refuses a blank message or one holding a NUL character', () => {
    for (const message of ['   ', 'Fix\0'])
      expect(() =>
        commitGroupsCoverSelection(
          [group(message, 'old.md', 'new.md', 'README.md')],
          capture,
          'message',
        ),
      ).toThrow(CommitGroupsMismatchError);
  });

  it('measures the message limit in UTF-8 bytes', () => {
    const atLimit = 'é'.repeat(8192);
    expect(() =>
      commitGroupsCoverSelection(
        [group(atLimit, 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
      ),
    ).not.toThrow();
    expect(() =>
      commitGroupsCoverSelection(
        [group(`${atLimit}a`, 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
      ),
    ).toThrow(CommitGroupsMismatchError);
  });
});
