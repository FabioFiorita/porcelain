import { expect, it } from 'vitest';
import {
  checkoutFolder,
  decisionMarked,
  reviewArchivable,
  reviewClosed,
  reviewListStatus,
  reviewListTitle,
  reviewPullRequestNotice,
  pullRequestBlockHidden,
  pullRequestLink,
} from './review-list.ts';
import type { ReviewRevision } from './verdict.ts';

const layer = {
  id: 'owner',
  fingerprint: 'current',
  title: 'Owner',
  summary: 'Shared rule',
  lanes: ['Client'],
  steps: [],
};
const revision: Pick<ReviewRevision, 'content' | 'verdict'> = {
  verdict: {
    asked: { text: 'Explain the new owner' },
    recommendation: 'hold',
    reasons: ['Needs review'],
    notProven: [],
    removed: [],
  },
  content: {
    environmentId: 'beelink',
    worktreeId: 'worktree',
    revision: 1,
    publishedAt: '2026-10-20T12:00:00Z',
    active: true,
    diagnostics: 'current',
    summary: { token: 'summary', byteLength: 0, expires: '', signature: '' },
    layers: [layer, { ...layer, id: 'consumer' }],
    notExplained: [{ path: 'missed.ts', ranges: [] }],
    proof: {
      current: true,
      checks: [{ name: 'Browser', result: 'fail' }],
      assets: [],
    },
  },
};
const mark = {
  layerId: 'owner',
  fingerprint: 'current',
  reviewedAt: '2026-10-20T12:00:00Z',
};
const allMarks = {
  files: [],
  decisions: [mark, { ...mark, layerId: 'consumer' }],
};

it.each([
  ['a current mark', allMarks, true],
  ['no marks yet', undefined, false],
  [
    'a mark from an older explanation',
    { files: [], decisions: [{ ...mark, fingerprint: 'old' }] },
    false,
  ],
  [
    'a mark on another decision',
    { files: [], decisions: [{ ...mark, layerId: 'consumer' }] },
    false,
  ],
  [
    'a current mark whose files changed since',
    {
      files: [
        {
          path: 'owner.ts',
          fingerprint: 'old',
          reviewedAt: mark.reviewedAt,
          stale: true,
        },
      ],
      decisions: [mark],
    },
    true,
  ],
])('reads a decision as reviewed from %s: %s', (_, marks, expected) => {
  expect(decisionMarked(marks?.decisions, layer)).toBe(expected);
});
it('counts current decision marks once, ignoring file marks, stale and unrelated decisions', () => {
  const result = reviewListStatus({
    revision,
    status: 'pending',
    marks: {
      files: [
        {
          path: 'file',
          fingerprint: 'blob',
          reviewedAt: mark.reviewedAt,
          stale: false,
        },
      ],
      decisions: [
        mark,
        mark,
        { ...mark, layerId: 'consumer', fingerprint: 'old' },
        { ...mark, layerId: 'unrelated' },
      ],
    },
  });
  expect(result).toEqual({
    reviewed: 1,
    total: 2,
    group: 'Needs you',
    badges: [
      { label: 'Proof failed', variant: 'destructive' },
      { label: '1 not explained', variant: 'outline' },
      { label: 'Agent says hold', variant: 'secondary' },
    ],
  });
});
it('waits for the agent after review and requires both merge recommendation and every current decision to be ready', () => {
  expect(
    reviewListStatus({ revision, marks: allMarks, status: undefined }).group,
  ).toBe('Waiting on agent');
  const merge = {
    ...revision,
    verdict: { ...revision.verdict, recommendation: 'merge' as const },
  };
  expect(
    reviewListStatus({
      revision: merge,
      marks: { files: [], decisions: [mark] },
      status: 'pending',
    }).group,
  ).toBe('Needs you');
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'reviewed' }),
  ).toMatchObject({
    group: 'Ready to merge',
    reviewed: 2,
    total: 2,
  });
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'replied' })
      .badges,
  ).toContainEqual({ label: 'Agent replied', variant: 'default' });
  expect(
    reviewListStatus({
      revision,
      marks: { files: [], decisions: [mark] },
      status: 'reviewed',
    }).badges,
  ).toContainEqual({ label: 'Waiting for a commit', variant: 'secondary' });
});
it('an agent reply takes precedence over readiness or waiting', () => {
  const merge = {
    ...revision,
    verdict: { ...revision.verdict, recommendation: 'merge' as const },
  };
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'replied' }),
  ).toMatchObject({
    group: 'Needs you',
  });
});
it('does not claim readiness while marks are unavailable or for an empty review', () => {
  expect(
    reviewListStatus({ revision, marks: undefined, status: undefined }),
  ).toMatchObject({ group: 'Needs you', reviewed: 0, total: 2 });
  expect(
    reviewListStatus({
      revision: {
        ...revision,
        verdict: { ...revision.verdict, recommendation: 'merge' },
        content: { ...revision.content, layers: [] },
      },
      marks: allMarks,
      status: undefined,
    }).group,
  ).toBe('Needs you');
});
it('uses the PR title, then the asked text, then the branch', () => {
  expect(reviewListTitle({ branch: 'feature' }, revision, 'PR title')).toBe(
    'PR title',
  );
  expect(reviewListTitle({ branch: 'feature' }, revision, undefined)).toBe(
    'Explain the new owner',
  );
  expect(reviewListTitle({ branch: 'feature' }, undefined, ' ')).toBe(
    'feature',
  );
});
it.each([
  ['/home/dev/code/worktrees/qa-531', 'qa-531', '/home/dev/code/worktrees'],
  ['/home/dev/code/worktrees/qa-532/', 'qa-532', '/home/dev/code/worktrees'],
  ['C:\\worktrees\\qa-533', 'qa-533', 'C:\\worktrees'],
  ['/qa-534', 'qa-534', '/'],
  ['qa-535', 'qa-535', undefined],
])(
  'names the detached checkout at %s by its folder and parent path',
  (path, name, parent) => {
    expect(checkoutFolder(path)).toEqual({ name, parent });
  },
);

it.each([
  ['an open pull request', false, 'open', false],
  ['a merged pull request', false, 'merged', true],
  ['a closed pull request', false, 'closed', true],
  ['an archived review', true, 'merged', false],
] as const)(
  'offers Archive for %s only once GitHub no longer has it open',
  (_, archived, state, expected) => {
    expect(
      reviewArchivable(
        { archived },
        { kind: 'available', pullRequest: { state } },
      ),
    ).toBe(expected);
  },
);

it('never offers Archive without a readable pull request', () => {
  expect([
    reviewArchivable({ archived: false }, undefined),
    reviewArchivable({ archived: false }, { kind: 'not-linked' }),
  ]).toEqual([false, false]);
});

it.each([
  ['an open review with an open pull request', false, 'open', 'open', false],
  ['a closed review', false, 'closed', 'open', true],
  ['an archived review', true, 'open', 'open', true],
  ['a merged pull request', false, 'open', 'merged', true],
] as const)(
  'treats %s as closed only once it leaves review',
  (_, archived, state, pull, expected) => {
    expect(
      reviewClosed(
        { archived, state },
        { kind: 'available', pullRequest: { state: pull } },
      ),
    ).toBe(expected);
  },
);

it.each([
  [
    'merged',
    { kind: 'available', pullRequest: { state: 'merged' } },
    'Closed',
    true,
  ],
  [
    'closed',
    { kind: 'available', pullRequest: { state: 'closed' } },
    'Closed',
    true,
  ],
  [
    'open',
    { kind: 'available', pullRequest: { state: 'open' } },
    'Ready to merge',
    false,
  ],
  [
    'unavailable',
    { kind: 'unavailable', reason: 'offline' },
    'Needs you',
    false,
  ],
  ['failed', { kind: 'failed' }, 'Needs you', false],
  ['loading', { kind: 'loading' }, 'Needs you', false],
  ['none', { kind: 'not-linked' }, 'Ready to merge', false],
] as const)(
  'keeps %s PR grouping and Archive honest',
  (_, pull, expected, archivable) => {
    const record = { state: 'open' as const, archived: false };
    const status = reviewListStatus({
      revision: {
        ...revision,
        verdict: { ...revision.verdict, recommendation: 'merge' },
      },
      marks: allMarks,
      status: 'reviewed',
      pull,
    });
    expect(reviewClosed(record, pull) ? 'Closed' : status.group).toBe(expected);
    expect(reviewArchivable(record, pull)).toBe(archivable);
  },
);

it('explains a GitHub failure without treating it as a known pull request state', () => {
  expect(
    reviewPullRequestNotice({ kind: 'unavailable', reason: 'offline' }),
  ).toBe('PR state unavailable: GitHub could not be reached.');
  expect(reviewPullRequestNotice({ kind: 'not-linked' })).toBeUndefined();
});

it.each([
  [
    'https://github.com/FabioFiorita/porcelain/pull/423',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  [
    '  https://github.com/FabioFiorita/porcelain/pull/423/  ',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  [
    'https://github.com/FabioFiorita/porcelain/pull/423/files',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  [
    'https://github.com/FabioFiorita/porcelain/pull/423/commits/abc123',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  [
    'https://github.com/FabioFiorita/porcelain/pull/423#issuecomment-1',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  [
    'https://github.com/FabioFiorita/porcelain/pull/423?notification_referrer_id=x',
    'https://github.com/FabioFiorita/porcelain/pull/423',
  ],
  ['https://github.com/FabioFiorita/porcelain/pull/0', undefined],
  ['https://github.com/FabioFiorita/porcelain/issues/423', undefined],
  ['https://example.com/FabioFiorita/porcelain/pull/423', undefined],
  ['http://github.com/FabioFiorita/porcelain/pull/423', undefined],
  ['https://github.com/FabioFiorita/porcelain/pull/423x', undefined],
  ['porcelain#423', undefined],
] as const)('reads the pull request link in %j as %j', (text, expected) => {
  expect(pullRequestLink(text)).toBe(expected);
});

const linkedPullRequest = 'https://github.com/FabioFiorita/porcelain/pull/423';
it.each([
  [undefined, { kind: 'unavailable', reason: 'not-github' }, true],
  [linkedPullRequest, { kind: 'unavailable', reason: 'not-github' }, false],
  [undefined, { kind: 'unavailable', reason: 'offline' }, false],
  [undefined, { kind: 'unavailable', reason: 'no-accounts' }, false],
  [
    undefined,
    {
      kind: 'available',
      account: 'work',
      pullRequests: [],
      truncated: false,
      recentlyClosedSince: '2026-10-20T00:00:00Z',
    },
    false,
  ],
  [undefined, undefined, false],
] as const)(
  'hides the pull request block for link %j and project answer %j: %j',
  (linked, projectPullRequests, hidden) => {
    expect(pullRequestBlockHidden(linked, projectPullRequests)).toBe(hidden);
  },
);
