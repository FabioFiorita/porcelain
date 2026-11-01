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
  isCurrentBranch,
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
it.each([
  { parentOids: [], graph: { merge: false, continues: false } },
  { parentOids: ['parent'], graph: { merge: false, continues: true } },
  { parentOids: ['left', 'right'], graph: { merge: true, continues: true } },
])(
  'labels a commit without losing refs or parent structure: $parentOids',
  ({ parentOids, graph }) => {
    expect(
      commitEntry({
        oid: '0123456789',
        subject: 'Fix the file',
        subjectTruncated: false,
        body: undefined,
        bodyTruncated: false,
        parentOids,
        author: { name: 'Developer', timestamp: '2026-01-01T00:00:00Z' },
        refs: [
          { kind: 'remote-branch', name: 'origin/topic' },
          { kind: 'tag', name: 'v1' },
          { kind: 'head', name: 'HEAD' },
        ],
      }),
    ).toEqual({
      id: '0123456789',
      subject: 'Fix the file',
      author: 'Developer',
      time: new Date('2026-01-01T00:00:00Z').toLocaleString(),
      shortHash: '0123456',
      refs: [
        { kind: 'remote-branch', name: 'origin/topic' },
        { kind: 'tag', name: 'v1' },
        { kind: 'head', name: 'HEAD' },
      ],
      graph,
    });
  },
);

const attached = {
  tipOid: undefined,
  head: { kind: 'attached' as const, ref: 'refs/heads/feature' },
};
const tracked = {
  name: 'topic',
  upstream: 'origin/topic',
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
        upstream: `origin/${name}`,
      },
      null,
    ),
  ).toEqual({
    name,
    counts: '0 ahead · 0 behind',
    upstream: `against origin/${name}`,
  });
});

it('keeps typed branch, remote and tag refs and hides the separate HEAD marker', () => {
  expect(
    shownRefs([
      { kind: 'local-branch', name: 'main' },
      { kind: 'remote-branch', name: 'origin/main' },
      { kind: 'tag', name: 'v1.0.0' },
      { kind: 'head', name: 'HEAD' },
    ]),
  ).toEqual([
    { kind: 'local-branch', name: 'main' },
    { kind: 'remote-branch', name: 'origin/main' },
    { kind: 'tag', name: 'v1.0.0' },
  ]);
  expect(shownRefs([])).toEqual([]);
});

it.each([
  ['local-branch', 'main', 'refs/heads/main', true],
  ['local-branch', 'other', 'refs/heads/main', false],
  ['remote-branch', 'main', 'refs/heads/main', false],
  ['tag', 'main', 'refs/heads/main', false],
  ['head', 'HEAD', 'refs/heads/HEAD', false],
  ['local-branch', 'main', undefined, false],
  ['local-branch', 'refs/heads/main', 'refs/heads/main', false],
  ['local-branch', 'refs/heads/main', 'refs/heads/refs/heads/main', true],
] as const)('highlights %s %s against %s: %s', (kind, name, head, current) => {
  const ref =
    kind === 'head' ? { kind, name: 'HEAD' as const } : { kind, name };
  expect(isCurrentBranch(ref, head)).toBe(current);
});

it.each(['topic/nested', 'refs/heads/topic', 'refs/tags/release'])(
  'keeps the actual branch name %s in tracking',
  (name) => {
    expect(branchTracking({ ...tracked, name }, attached).name).toBe(name);
  },
);

it.each(['refs/heads/topic', 'refs/tags/release', 'origin/refs/heads/topic'])(
  'keeps the actual commit decoration %s',
  (ref) => {
    expect(
      commitEntry({
        oid: '0123456789',
        subject: 'Keep names',
        subjectTruncated: false,
        body: undefined,
        bodyTruncated: false,
        parentOids: [],
        author: { name: 'Developer', timestamp: '2026-01-01T00:00:00Z' },
        refs: [{ kind: 'local-branch', name: ref }],
      }).refs,
    ).toEqual([{ kind: 'local-branch', name: ref }]);
  },
);

it('keeps the actual upstream name even when its remote is named refs', () => {
  expect(
    branchTracking({ ...tracked, upstream: 'refs/remotes/topic' }, attached)
      .upstream,
  ).toBe('against refs/remotes/topic');
});
