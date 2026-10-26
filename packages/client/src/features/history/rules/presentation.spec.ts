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
  shownRefs,
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
      refs: [
        'refs/remotes/origin/topic',
        'refs/tags/v1',
        'refs/porcelain/reviews/internal/1',
      ],
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

const attached = {
  tipOid: undefined,
  head: { kind: 'attached' as const, ref: 'refs/heads/feature' },
};
const tracked = {
  name: 'topic',
  upstream: 'refs/remotes/origin/topic',
  ahead: 0,
  behind: 0,
};
it.each([
  [2, 0, '2 ahead · 0 behind'],
  [0, 3, '0 ahead · 3 behind'],
  [2, 3, '2 ahead · 3 behind'],
  [0, 0, '0 ahead · 0 behind'],
])(
  'compares %i ahead and %i behind against the labelled upstream',
  (ahead, behind, counts) => {
    expect(branchTracking({ ...tracked, ahead, behind }, attached)).toEqual({
      name: 'topic',
      counts,
      upstream: 'against origin/topic',
    });
  },
);
it.each([undefined, ''])('hides counts without upstream %s', (upstream) => {
  expect(
    branchTracking({ ...tracked, upstream, ahead: 2, behind: 3 }, attached),
  ).toEqual({
    name: 'topic',
    counts: null,
    upstream: 'No upstream',
  });
});
it.each([undefined, ''])('hides counts for detached branch name %s', (name) => {
  expect(
    branchTracking({ ...tracked, name, ahead: 2, behind: 3 }, attached),
  ).toEqual({
    name: 'Detached HEAD',
    counts: null,
    upstream: 'No branch checked out',
  });
});
it.each([
  [{ kind: 'attached' as const, ref: 'refs/heads/main' }, 'main'],
  [{ kind: 'unborn' as const, ref: 'refs/heads/new' }, 'No commits yet on new'],
  [{ kind: 'detached' as const }, 'Detached HEAD'],
])(
  'keeps the snapshot heading when branch status is unavailable: %s',
  (head, name) => {
    expect(branchTracking(undefined, { tipOid: undefined, head })).toEqual({
      name,
      counts: null,
      upstream: 'Branch status unavailable',
    });
  },
);
it('retains complete long branch and upstream names', () => {
  const name = `topic/${'long-'.repeat(40)}branch`;
  expect(
    branchTracking(
      {
        ...tracked,
        name,
        upstream: `refs/remotes/origin/${name}`,
      },
      null,
    ),
  ).toEqual({
    name,
    counts: '0 ahead · 0 behind',
    upstream: `against origin/${name}`,
  });
});

it('keeps branch, remote and tag refs and drops Porcelain internal refs', () => {
  expect(
    shownRefs([
      'refs/heads/main',
      'refs/porcelain/reviews/f3cb63e8-a489-4b2d-81e8-720b83bbabc0/1',
      'refs/remotes/origin/main',
      'refs/tags/v1.0.0',
      'HEAD',
    ]),
  ).toEqual([
    'refs/heads/main',
    'refs/remotes/origin/main',
    'refs/tags/v1.0.0',
    'HEAD',
  ]);
});

it.each(['topic/nested', 'refs/heads/topic', 'refs/tags/release'])(
  'keeps the actual branch name %s in tracking',
  (name) => {
    expect(branchTracking({ ...tracked, name }, attached).name).toBe(name);
  },
);
