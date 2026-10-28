import { expect, it } from 'vitest';
import {
  checkoutFolder,
  reviewArchivable,
  reviewClosed,
  emptyReviewListFilter,
  filterReviewList,
  reviewListGroups,
  reviewListStatus,
  reviewListTitle,
  reviewPullRequestNotice,
  pullRequestStateLabel,
  pullRequestBlockHidden,
  pullRequestLink,
  reviewListMeta,
  reviewListSignal,
  reviewListRowContext,
  reviewListCheckout,
  reviewListView,
  reviewListOptions,
  reviewListFilterItems,
  toggleReviewListFilter,
  type ReviewListEntry,
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

it('pins Projects above the four review statuses', () => {
  expect(reviewListGroups).toEqual([
    'Projects',
    'Needs you',
    'Waiting on agent',
    'Ready to merge',
    'No review',
  ]);
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
const entry: ReviewListEntry = {
  key: 'a',
  environmentId: 'beelink',
  environmentName: 'Beelink',
  projectId: 'porcelain',
  projectName: 'Porcelain',
  worktreeId: 'worktree',
  path: '/code/feature',
  reviewId: 'review',
  branch: 'feature',
  detached: false,
  title: 'Shared reviews',
  group: 'Needs you',
  closed: false,
  reviewed: 1,
  total: 2,
  badges: [],
  disabled: false,
  publishedAt: '2026-10-20T12:00:00Z',
  pullRequestNumber: '433',
};
const other: ReviewListEntry = {
  ...entry,
  key: 'b',
  projectId: 'tastik',
  projectName: 'Tastik',
  environmentId: 'mac',
  environmentName: 'MacBook',
  title: 'Mobile lists',
};
it('searches across projects and environments, intersects optional filters and keeps closed reviews separate', () => {
  const entries = [entry, other, { ...entry, key: 'closed', closed: true }];
  expect(
    filterReviewList(entries, '', emptyReviewListFilter, false).map(
      (row) => row.key,
    ),
  ).toEqual(['a', 'b']);
  expect(
    filterReviewList(
      entries,
      'porcelain 433 /code',
      emptyReviewListFilter,
      false,
    ).map((row) => row.key),
  ).toEqual(['a']);
  expect(
    filterReviewList(
      entries,
      '',
      { projects: ['beelink/porcelain'], environments: ['mac'] },
      false,
    ),
  ).toEqual([]);
  expect(
    filterReviewList(
      entries,
      '',
      { projects: [], environments: undefined },
      false,
    ),
  ).toEqual([]);
  expect(
    filterReviewList(entries, '', emptyReviewListFilter, true).map(
      (row) => row.key,
    ),
  ).toEqual(['closed']);
  expect(
    filterReviewList(
      [{ ...entry, reviewId: undefined, group: 'No review' }],
      'feature',
      emptyReviewListFilter,
      false,
    ),
  ).toHaveLength(1);
});
it('offers distinct scoped filters, lets the last checkbox be cleared and restores all choices by clearing filters', () => {
  const options = reviewListOptions([entry, entry, other]);
  expect(options.projects).toEqual([
    { id: 'beelink/porcelain', label: 'Porcelain · Beelink' },
    { id: 'mac/tastik', label: 'Tastik · MacBook' },
  ]);
  expect(options.environments).toEqual([
    { id: 'beelink', label: 'Beelink' },
    { id: 'mac', label: 'MacBook' },
  ]);
  expect(reviewListFilterItems(options.environments, undefined)).toEqual([
    { id: 'beelink', label: 'Beelink', checked: true, next: ['mac'] },
    { id: 'mac', label: 'MacBook', checked: true, next: ['beelink'] },
  ]);
  expect(toggleReviewListFilter(['mac'], 'mac')).toEqual([]);
  expect(toggleReviewListFilter([], 'mac')).toEqual(['mac']);
  expect(
    reviewListFilterItems(options.environments, []).map((item) => item.checked),
  ).toEqual([false, false]);
});
it('keeps computer names separate from project, PR or branch and relative publication time', () => {
  expect(reviewListMeta(entry, Date.parse('2026-10-20T12:04:00Z'))).toBe(
    'Porcelain · #433 · 4m',
  );
  expect(
    reviewListMeta(
      { ...entry, pullRequestNumber: undefined },
      Date.parse('2026-10-20T13:00:00Z'),
    ),
  ).toBe('Porcelain · feature · 1h');
  expect(
    reviewListMeta(
      { ...entry, publishedAt: undefined, pullRequestNumber: undefined },
      0,
    ),
  ).toBe('Porcelain · feature');
});

it('combines search and checkbox state without changing the source entries', () => {
  const view = reviewListView(
    [entry, other],
    'Mobile',
    emptyReviewListFilter,
    false,
  );
  expect(view.rows.map((row) => row.key)).toEqual(['b']);
  expect(
    view.filters.find((section) => section.label === 'Projects')?.items,
  ).toHaveLength(2);
  expect(
    view.filters
      .find((section) => section.label === 'Environments')
      ?.items.map((item) => item.checked),
  ).toEqual([true, true]);
});

it('applies search and both filters to main checkout rows and uses compact project metadata', () => {
  const main: ReviewListEntry = {
    ...entry,
    group: 'Projects',
    title: 'Porcelain',
    branch: 'main',
    reviewId: undefined,
  };
  const entries = [
    main,
    { ...other, group: 'Projects' as const, branch: 'develop' },
  ];
  expect(
    reviewListView(
      entries,
      'porcelain main beelink',
      emptyReviewListFilter,
      false,
    ).rows,
  ).toEqual([main]);
  expect(
    reviewListView(
      entries,
      '',
      { projects: ['beelink/porcelain'], environments: ['beelink'] },
      false,
    ).rows,
  ).toEqual([main]);
  expect(
    reviewListView(
      entries,
      '',
      { projects: ['beelink/porcelain'], environments: ['mac'] },
      false,
    ).rows,
  ).toEqual([]);
  expect(reviewListMeta(main, 0)).toBe('main');
});

it('uses one status indicator, prioritizing failed proof while keeping secondary reasons intact', () => {
  const reasons = [
    { label: 'Proof failed', variant: 'destructive' as const },
    { label: '1 not explained', variant: 'outline' as const },
    { label: 'Agent says hold', variant: 'secondary' as const },
  ];
  expect(reviewListSignal({ ...entry, badges: reasons })).toEqual({
    reason: 'Proof failed',
    tone: 'destructive',
  });
  expect(reasons.map((reason) => reason.label)).toEqual([
    'Proof failed',
    '1 not explained',
    'Agent says hold',
  ]);
  expect(
    reviewListSignal({ ...entry, group: 'Ready to merge', badges: [] }),
  ).toEqual({ reason: 'Ready to merge', tone: 'primary' });
  expect(
    reviewListSignal({ ...entry, group: 'Waiting on agent', badges: [] }),
  ).toEqual({ reason: 'Waiting on agent', tone: 'muted' });
  expect(
    reviewListSignal({ ...entry, reviewId: undefined, badges: [] }),
  ).toBeUndefined();
});

it.each([
  [
    '/home/dev/code/porcelain-worktrees/qa-531',
    'qa-531',
    '/home/dev/code/porcelain-worktrees',
  ],
  [
    '/home/dev/code/porcelain-worktrees/qa-532/',
    'qa-532',
    '/home/dev/code/porcelain-worktrees',
  ],
  ['C:\\worktrees\\qa-533', 'qa-533', 'C:\\worktrees'],
  ['/qa-534', 'qa-534', '/'],
  ['qa-535', 'qa-535', undefined],
])(
  'names the detached checkout at %s by its folder before its parent path',
  (path, name, parent) => {
    const detached = {
      ...entry,
      reviewId: undefined,
      group: 'No review' as const,
      branch: 'Detached HEAD',
      detached: true,
      path,
    };
    expect(checkoutFolder(path)).toEqual({ name, parent });
    expect(reviewListCheckout(detached)).toEqual({ name, parent, full: path });
    expect(reviewListRowContext(detached, false)).toEqual({
      project: 'Porcelain',
      branch: undefined,
      location: parent,
    });
  },
);

it('keeps the branch as the label of an attached checkout', () => {
  expect(reviewListCheckout(entry)).toEqual({
    name: 'feature',
    parent: undefined,
    full: 'feature',
  });
});

it('adds project context only for multiple visible projects and avoids repeating unreviewed branches', () => {
  expect(reviewListRowContext(entry, false)).toEqual({
    project: undefined,
    branch: 'feature',
  });
  expect(reviewListRowContext(entry, true)).toEqual({
    project: 'Porcelain',
    branch: 'feature',
  });
  expect(reviewListRowContext({ ...entry, group: 'Projects' }, true)).toEqual({
    project: undefined,
    branch: 'feature',
  });
  expect(
    reviewListRowContext(
      { ...entry, group: 'No review', reviewId: undefined },
      false,
    ),
  ).toEqual({ project: 'Porcelain', branch: undefined });
  expect(
    reviewListView([entry, other], '', emptyReviewListFilter, false)
      .multipleProjects,
  ).toBe(true);
  expect(
    reviewListView([entry, other], 'porcelain', emptyReviewListFilter, false)
      .multipleProjects,
  ).toBe(false);
  expect(
    reviewListView(
      [entry, other],
      '',
      { projects: ['beelink/porcelain'], environments: undefined },
      false,
    ).multipleProjects,
  ).toBe(false);
  expect(
    reviewListView(
      [entry, { ...entry, key: 'duplicate' }],
      '',
      emptyReviewListFilter,
      false,
    ).multipleProjects,
  ).toBe(false);
  expect(
    reviewListView(
      [entry, { ...entry, environmentId: 'mac' }],
      '',
      emptyReviewListFilter,
      false,
    ).multipleProjects,
  ).toBe(true);
});

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
  ['open', false, 'Open'],
  ['open', true, 'Draft'],
  ['closed', true, 'Closed'],
  ['merged', true, 'Merged'],
] as const)('labels a %s PR with draft %s as %s', (state, draft, expected) => {
  expect(pullRequestStateLabel({ state, draft })).toBe(expected);
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
