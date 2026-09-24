import type {
  CommitDraftCapture,
  CommitGroupLimits,
} from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import { commitGroupsCoverSelection } from './commit-groups-cover-selection.ts';

const limits: CommitGroupLimits = { maxGroups: 20, maxMessageBytes: 16_384 };
const capture: CommitDraftCapture = {
  paths: ['old.md', 'new.md', 'README.md'],
  bundles: [['old.md', 'new.md'], ['README.md']],
  evidence: '{}',
  expectedFiles: [],
};
const group = (message: string, ...paths: string[]) => ({ message, paths });

describe('commitGroupsCoverSelection', () => {
  it('accepts groups that use every selected path once and keep a rename together', () => {
    expect(
      commitGroupsCoverSelection(
        [group('Rename', 'old.md', 'new.md'), group('Docs', 'README.md')],
        capture,
        'groups',
        limits,
      ),
    ).toBe(true);
  });

  it('accepts one message covering everything in message mode', () => {
    expect(
      commitGroupsCoverSelection(
        [group('All', 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
        limits,
      ),
    ).toBe(true);
  });

  it('refuses several groups in message mode', () => {
    expect(
      commitGroupsCoverSelection(
        [group('Rename', 'old.md', 'new.md'), group('Docs', 'README.md')],
        capture,
        'message',
        limits,
      ),
    ).toBe(false);
  });

  it('refuses a rename split across groups', () => {
    expect(
      commitGroupsCoverSelection(
        [group('Old', 'old.md', 'README.md'), group('New', 'new.md')],
        capture,
        'groups',
        limits,
      ),
    ).toBe(false);
  });

  it('refuses a missing, repeated or unknown path', () => {
    for (const groups of [
      [group('Rename', 'old.md', 'new.md')],
      [group('All', 'old.md', 'new.md', 'README.md', 'README.md')],
      [group('All', 'old.md', 'new.md', 'GUIDE.md')],
    ])
      expect(
        commitGroupsCoverSelection(groups, capture, 'groups', limits),
      ).toBe(false);
  });

  it('refuses no groups and an empty group', () => {
    const single: CommitDraftCapture = {
      ...capture,
      paths: ['README.md'],
      bundles: [['README.md']],
    };
    expect(commitGroupsCoverSelection([], single, 'groups', limits)).toBe(
      false,
    );
    expect(
      commitGroupsCoverSelection(
        [group('Docs', 'README.md'), group('Nothing')],
        single,
        'groups',
        limits,
      ),
    ).toBe(false);
  });

  it('accepts as many groups as the limit allows and refuses one more', () => {
    const paths = ['a.md', 'b.md', 'c.md'];
    const selection = {
      ...capture,
      paths,
      bundles: paths.map((path) => [path]),
    };
    const groups = paths.map((path) => group(path, path));
    expect(
      commitGroupsCoverSelection(groups, selection, 'groups', {
        ...limits,
        maxGroups: 3,
      }),
    ).toBe(true);
    expect(
      commitGroupsCoverSelection(groups, selection, 'groups', {
        ...limits,
        maxGroups: 2,
      }),
    ).toBe(false);
  });

  it('refuses a blank message or one holding a NUL character', () => {
    for (const message of ['   ', 'Fix\0'])
      expect(
        commitGroupsCoverSelection(
          [group(message, 'old.md', 'new.md', 'README.md')],
          capture,
          'message',
          limits,
        ),
      ).toBe(false);
  });

  it('measures the message limit in UTF-8 bytes', () => {
    const atLimit = 'é'.repeat(8192);
    expect(
      commitGroupsCoverSelection(
        [group(atLimit, 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
        limits,
      ),
    ).toBe(true);
    expect(
      commitGroupsCoverSelection(
        [group(`${atLimit}a`, 'old.md', 'new.md', 'README.md')],
        capture,
        'message',
        limits,
      ),
    ).toBe(false);
  });
});
