import { expect, it } from 'vitest';
import {
  branchTracking,
  commitEntry,
  commitPath,
  commitPaths,
  historyBoundary,
  historyHeading,
  refLabel,
  shortOid,
} from './presentation.ts';
const file = {
  status: 'modified' as const,
  oldMode: '100644',
  newMode: '100644',
};
it('keeps both rename paths and the surviving path for additions and deletions', () => {
  expect(
    commitPaths({ ...file, oldPath: 'before.ts', newPath: 'after.ts' }),
  ).toEqual(['before.ts', 'after.ts']);
  expect(
    commitPaths({ ...file, oldPath: 'same.ts', newPath: 'same.ts' }),
  ).toEqual(['same.ts']);
  expect(
    commitPaths({ ...file, oldPath: undefined, newPath: 'added.ts' }),
  ).toEqual(['added.ts']);
  expect(
    commitPaths({ ...file, oldPath: 'deleted.ts', newPath: undefined }),
  ).toEqual(['deleted.ts']);
  expect(
    commitPath({ ...file, oldPath: 'before.ts', newPath: 'after.ts' }),
  ).toBe('after.ts');
  expect(
    commitPath({ ...file, oldPath: 'deleted.ts', newPath: undefined }),
  ).toBe('deleted.ts');
});
it('shows the actual branch state and history boundary', () => {
  expect(
    historyHeading({
      tipOid: undefined,
      head: { kind: 'unborn', ref: 'refs/heads/new' },
    }),
  ).toBe('No commits yet on new');
  expect(
    historyHeading({
      tipOid: undefined,
      head: { kind: 'attached', ref: 'refs/heads/main' },
    }),
  ).toBe('main');
  expect(
    historyHeading({ tipOid: undefined, head: { kind: 'detached' } }),
  ).toBe('Detached HEAD');
  expect(historyBoundary('shallow')).toBe(
    'Shallow clone: older history is not available.',
  );
  expect(historyBoundary('wide')).toBe(
    'Too many branches meet here to continue past this point.',
  );
  expect(historyBoundary(undefined)).toBe('Start of history.');
});

it('keeps short object IDs intact and limits full IDs to seven characters', () => {
  expect([shortOid(''), shortOid('abc'), shortOid('0123456789')]).toEqual([
    '',
    'abc',
    '0123456',
  ]);
});
it('labels local, remote and tag refs without removing their identity', () => {
  expect(
    [
      'refs/heads/main',
      'refs/remotes/origin/topic',
      'refs/tags/v1',
      'HEAD',
    ].map(refLabel),
  ).toEqual(['main', 'origin/topic', 'v1', 'HEAD']);
});
it('labels a commit with its subject, author, hash, refs and local time', () => {
  expect(
    commitEntry({
      oid: '0123456789',
      subject: 'Fix the file',
      subjectTruncated: false,
      body: undefined,
      bodyTruncated: false,
      parentOids: [],
      author: { name: 'Developer', timestamp: '2026-01-01T00:00:00Z' },
      refs: ['refs/remotes/origin/topic', 'refs/tags/v1'],
    }),
  ).toEqual({
    id: '0123456789',
    subject: 'Fix the file',
    author: 'Developer',
    time: new Date('2026-01-01T00:00:00Z').toLocaleString(),
    shortHash: '0123456',
    refs: ['origin/topic', 'v1'],
  });
});

it('names the branch and counts ahead and behind against its upstream', () => {
  const attached = {
    tipOid: undefined,
    head: { kind: 'attached' as const, ref: 'refs/heads/feature' },
  };
  expect(
    branchTracking(
      {
        name: 'refs/heads/review/revoke-access',
        upstream: 'refs/remotes/origin/review/revoke-access',
        ahead: 2,
        behind: 0,
      },
      attached,
    ),
  ).toEqual({
    name: 'review/revoke-access',
    counts: '2 ahead · 0 behind',
    upstream: 'against origin/review/revoke-access',
  });
  expect(
    branchTracking(
      { name: 'feature', upstream: undefined, ahead: 0, behind: 0 },
      attached,
    ),
  ).toEqual({ name: 'feature', counts: null, upstream: 'No upstream' });
  expect(
    branchTracking(
      { name: undefined, upstream: undefined, ahead: 0, behind: 0 },
      attached,
    ),
  ).toEqual({
    name: 'Detached HEAD',
    counts: null,
    upstream: 'No branch checked out',
  });
  expect(branchTracking(undefined, attached)).toEqual({
    name: 'feature',
    counts: null,
    upstream: 'Branch status unavailable',
  });
});
