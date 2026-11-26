import { expect, it } from 'vite-plus/test';
import {
  checksHeadline,
  currentWalkthroughChecks,
  recordedCheckNow,
  mergeConfirmation,
  pullRequestCheckout,
  callNotesAtHead,
  walkthroughCheckRows,
  githubUnavailable,
  pullRequestChecks,
  pullRequestConversation,
  type PullRequestRead,
  pullRequestMergeable,
  pullRequestMergeBlock,
  pullRequestMergeMethods,
  pullRequestNumber,
  pullRequestRepository,
  pullRequestRollup,
  pullRequestState,
  pullRequestStateLabel,
  pullReviewState,
  recordedChecks,
} from './pull-request.ts';

const passed = { name: 'static', status: 'COMPLETED', conclusion: 'SUCCESS' };
const skipped = { name: 'docs', status: 'COMPLETED', conclusion: 'SKIPPED' };
const running = { name: 'e2e', status: 'IN_PROGRESS' };
const pending = { name: 'ci/legacy', status: 'PENDING' };
const failed = { name: 'units', status: 'COMPLETED', conclusion: 'FAILURE' };
const errored = { name: 'ci/legacy', status: 'COMPLETED', conclusion: 'ERROR' };

it.each([
  [[], false, { tone: 'none', label: 'No checks', short: 'No checks' }],
  [
    Array.from({ length: 12 }, () => passed),
    false,
    { tone: 'passed', label: '12 checks passed', short: '12 checks' },
  ],
  [
    [passed],
    false,
    { tone: 'passed', label: '1 check passed', short: '1 check' },
  ],
  [
    [passed, skipped],
    true,
    {
      tone: 'none',
      label: '2+ checks listed · result incomplete',
      short: 'Checks incomplete',
    },
  ],
  [
    [
      ...Array.from({ length: 8 }, () => passed),
      running,
      pending,
      running,
      running,
    ],
    false,
    { tone: 'running', label: '4 of 12 checks running', short: '4 running' },
  ],
  [
    [passed, running, failed, errored],
    false,
    { tone: 'failed', label: '2 of 4 checks failed', short: '2 failed' },
  ],
])('summarises %j as GitHub checks', (checks, truncated, expected) => {
  expect(pullRequestChecks(checks, truncated)).toEqual(expected);
});

it.each([
  ['SUCCESS', { tone: 'passed', label: 'Checks passing' }],
  ['PENDING', { tone: 'running', label: 'Checks running' }],
  ['EXPECTED', { tone: 'running', label: 'Checks running' }],
  ['FAILURE', { tone: 'failed', label: 'Checks failing' }],
  ['ERROR', { tone: 'failed', label: 'Checks failing' }],
  [undefined, { tone: 'none', label: 'No checks' }],
])('names the rollup %s without GitHub’s raw value', (summary, expected) => {
  expect(pullRequestRollup(summary)).toEqual(expected);
});

it.each([
  ['no-access', 'settings', 'Choose an account'],
  ['gh-not-installed', 'install', 'How to install'],
  ['no-accounts', 'copy', 'Copy gh auth login'],
  ['rate-limited', 'retry', 'Try again'],
  ['offline', 'retry', 'Try again'],
  ['invalid-response', 'retry', 'Try again'],
  ['pull-request-not-found', 'retry', 'Try again'],
] as const)('offers the way out of %s', (reason, kind, label) => {
  expect(githubUnavailable(reason).action).toMatchObject({ kind, label });
});

it('sends a missing account to Settings by name', () => {
  expect(githubUnavailable('no-access').description).toBe(
    'The chosen or detected GitHub account cannot open this repository. Choose another account or reset the choice in Settings › Changes & Git.',
  );
});

it.each([
  ['MERGEABLE', 'No conflicts'],
  ['CONFLICTING', 'Conflicts'],
  ['UNKNOWN', 'Not known yet'],
])('labels mergeable %s', (mergeable, label) => {
  expect(pullRequestMergeable(mergeable).label).toBe(label);
});

it.each([
  ['APPROVED', 'Approved'],
  ['CHANGES_REQUESTED', 'Changes requested'],
  ['DISMISSED', 'Dismissed'],
  ['COMMENTED', undefined],
  [undefined, undefined],
])('labels the GitHub review state %s', (state, label) => {
  expect(pullReviewState(state)?.label).toBe(label);
});

it('reads the number and repository from a pull request link', () => {
  const url = 'https://github.com/FabioFiorita/porcelain/pull/482';
  expect(pullRequestNumber(url)).toBe(482);
  expect(pullRequestRepository(url)).toBe('FabioFiorita/porcelain');
  expect(pullRequestNumber('https://github.com/a/b')).toBeUndefined();
});

it.each([
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'STALE',
])('never calls %s checks passed', (conclusion) => {
  expect(
    pullRequestChecks([{ name: 'ci', status: 'COMPLETED', conclusion }], false),
  ).toEqual({
    tone: 'failed',
    label: '1 of 1 check failed',
    short: '1 failed',
  });
});

it.each(['QUEUED', 'REQUESTED', 'WAITING', 'PENDING', 'IN_PROGRESS'])(
  'keeps %s checks running',
  (status) => {
    expect(pullRequestChecks([{ name: 'ci', status }], false)).toEqual({
      tone: 'running',
      label: '1 of 1 check running',
      short: '1 running',
    });
  },
);

it.each([
  [
    'SUCCESS',
    { tone: 'passed', label: 'Checks passing', short: 'Checks passing' },
  ],
  [
    'FAILURE',
    { tone: 'failed', label: 'Checks failing', short: 'Checks failing' },
  ],
  [
    'PENDING',
    { tone: 'running', label: 'Checks running', short: 'Checks running' },
  ],
  [
    undefined,
    {
      tone: 'none',
      label: '1+ checks listed · result incomplete',
      short: 'Checks incomplete',
    },
  ],
] as const)(
  'uses the authoritative %s rollup for a partial check list',
  (summary, expected) => {
    expect(pullRequestChecks([passed], true, summary)).toEqual(expected);
  },
);

it('counts a required status that has not reported as running', () => {
  expect(
    pullRequestChecks([{ ...passed, conclusion: 'EXPECTED' }], false),
  ).toMatchObject({ tone: 'running' });
});

it.each([
  ['open', false, 'open', 'Open'],
  ['open', true, 'draft', 'Draft'],
  ['closed', false, 'closed', 'Closed'],
  ['closed', true, 'closed', 'Closed'],
  ['merged', true, 'merged', 'Merged'],
] as const)(
  'shows a %s PR with draft %s as %s, labelled %s',
  (state, draft, shown, label) => {
    expect(pullRequestState({ state, draft })).toBe(shown);
    expect(pullRequestStateLabel({ state, draft })).toBe(label);
  },
);

it('nests inline comments under their review while retaining orphan and older-server comments', () => {
  type TimelineItem = Extract<
    PullRequestRead,
    { kind: 'available' }
  >['pullRequest']['timeline'][number];
  const item = (
    id: string,
    kind: TimelineItem['kind'],
    reviewId?: string,
  ): TimelineItem => ({
    id,
    kind,
    reviewId,
    author: undefined,
    time: '2026-10-19T12:00:00Z',
    body: id,
    url: 'https://github.com/comment',
  });
  const entries = [
    item('inline', 'review-comment', 'review'),
    item('orphan', 'review-comment', 'missing'),
    item('legacy', 'review-comment'),
    item('issue', 'comment'),
    item('review', 'review'),
  ];
  expect(
    pullRequestConversation(entries).map(({ item, comments }) => ({
      id: item.id,
      comments: comments.map((comment) => comment.id),
    })),
  ).toEqual([
    { id: 'orphan', comments: [] },
    { id: 'legacy', comments: [] },
    { id: 'issue', comments: [] },
    { id: 'review', comments: ['inline'] },
  ]);
  expect(pullRequestConversation([])).toEqual([]);
});

it('names each recorded check result and the commit it ran on', () => {
  const recorded = (
    state: string,
    results: readonly { name: string; status: string }[],
  ) =>
    recordedChecks({
      headOid: 'abcdef1234567',
      state,
      checksTruncated: true,
      results,
    });
  expect(
    recorded('FAILURE', [
      { name: 'Unit', status: 'SUCCESS' },
      { name: 'Browser', status: 'FAILURE' },
      { name: 'Deploy', status: 'TIMED_OUT' },
      { name: 'Lint', status: 'IN_PROGRESS' },
      { name: 'Docs', status: 'SKIPPED' },
      { name: 'Audit', status: 'NEUTRAL' },
      { name: 'Future', status: 'SOMETHING_NEW' },
    ]),
  ).toEqual({
    label: 'Checks failing at abcdef1',
    whenWritten: 'Failing when written, at abcdef1',
    more: true,
    results: [
      { name: 'Unit', tone: 'passed', label: 'Passed', detail: undefined },
      { name: 'Browser', tone: 'failed', label: 'Failed', detail: undefined },
      {
        name: 'Deploy',
        tone: 'failed',
        label: 'Timed out',
        detail: 'Timed out',
      },
      { name: 'Lint', tone: 'running', label: 'Running', detail: undefined },
      { name: 'Docs', tone: 'none', label: 'Skipped', detail: 'Skipped' },
      { name: 'Audit', tone: 'none', label: 'Neutral', detail: 'Neutral' },
      {
        name: 'Future',
        tone: 'none',
        label: 'Something new',
        detail: 'Something new',
      },
    ],
  });
  expect(recorded('PENDING', []).label).toBe('Checks running at abcdef1');
  expect(recorded('SOMETHING_NEW', []).label).toBe('Checks at abcdef1');
});

const mergeablePull = {
  state: 'open',
  draft: false,
  mergeable: 'MERGEABLE',
  checks: [passed],
  checksTruncated: false,
  checksSummary: 'SUCCESS',
  baseBranch: 'main',
  headSha: '653d8396c7c1b6a503c3096d3f46a0f45cf33ca8',
} as const;

it.each([
  [{}, undefined],
  [{ state: 'closed' }, 'This pull request is closed.'],
  [{ draft: true }, 'It is a draft. Mark it ready for review on GitHub.'],
  [{ mergeMethods: [] }, 'This repository allows no merge method.'],
  [{ mergeable: 'CONFLICTING' }, 'It conflicts with main.'],
  [{ mergeable: 'UNKNOWN' }, undefined],
  [{ checks: [passed, failed] }, '1 of 2 checks failed.'],
  [{ checks: [passed, running, pending] }, '2 of 3 checks running.'],
  [
    { checks: [passed], checksTruncated: true, checksSummary: 'PENDING' },
    'Checks are still running.',
  ],
] as const)('explains why %o cannot merge', (change, reason) => {
  expect(pullRequestMergeBlock({ ...mergeablePull, ...change })).toBe(reason);
});

it('blocks an undecided call only for the head that would merge', () => {
  expect(
    pullRequestMergeBlock(mergeablePull, {
      headOid: mergeablePull.headSha,
      undecidedCallStep: undefined,
    }),
  ).toBeUndefined();
  expect(
    pullRequestMergeBlock(mergeablePull, {
      headOid: 'ba370399bd1b3ac1a2c5a1d0f00df00df00df00d',
      undecidedCallStep: 2,
    }),
  ).toBeUndefined();
  expect(
    pullRequestMergeBlock(mergeablePull, {
      headOid: mergeablePull.headSha,
      undecidedCallStep: 2,
    }),
  ).toBe('Your call in step 2 is not decided yet.');
  expect(
    pullRequestMergeBlock(mergeablePull, {
      headOid: mergeablePull.headSha,
      undecidedCallStep: 'reading',
    }),
  ).toBe('Reading your decisions on the calls.');
  expect(
    pullRequestMergeBlock(mergeablePull, {
      headOid: mergeablePull.headSha,
      undecidedCallStep: 'unreadable',
    }),
  ).toBe('Your decisions on the calls could not be read.');
  expect(
    pullRequestMergeBlock(
      { ...mergeablePull, checks: [failed] },
      { headOid: mergeablePull.headSha, undecidedCallStep: 2 },
    ),
  ).toBe('1 of 1 check failed.');
});

it('offers the merge methods the repository allows, or all three when unknown', () => {
  expect(
    pullRequestMergeMethods({ mergeMethods: ['squash'] }).map(
      ({ label }) => label,
    ),
  ).toEqual(['Squash and merge']);
  expect(pullRequestMergeMethods({}).map(({ method }) => method)).toEqual([
    'merge',
    'squash',
    'rebase',
  ]);
});

it('puts the live result first when the same captured head starts failing', () => {
  const captured = {
    headOid: 'abc1234',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Browser tests', status: 'SUCCESS' }],
  };
  const live = {
    headSha: 'abc1234',
    checks: [
      { name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE' },
    ],
    checksTruncated: false,
  };
  expect(currentWalkthroughChecks(captured, live)).toEqual({
    tone: 'failed',
    label: 'Failing now',
    names: ['Browser tests'],
    changed: [{ name: 'Browser tests', tone: 'failed', label: 'Failing now' }],
  });
  expect(recordedChecks(captured).label).toBe('Checks passing at abc1234');
  expect(recordedChecks(captured).whenWritten).toBe(
    'Passing when written, at abc1234',
  );
  expect(
    currentWalkthroughChecks(captured, { ...live, headSha: 'def5678' }),
  ).toBeUndefined();
  expect(currentWalkthroughChecks(captured, undefined)).toBeUndefined();
  expect(
    currentWalkthroughChecks(captured, {
      ...live,
      checks: [
        { name: 'Browser tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ],
    }),
  ).toBeUndefined();
});

it('says what each check does now beside what it did when written', () => {
  const captured = {
    headOid: 'abc1234',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [
      { name: 'Browser tests', status: 'SUCCESS' },
      { name: 'Unit tests', status: 'SUCCESS' },
    ],
  };
  const live = currentWalkthroughChecks(captured, {
    headSha: 'abc1234',
    checks: [
      { name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      { name: 'Unit tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ],
    checksTruncated: false,
  });
  const [browser, unit] = recordedChecks(captured).results;
  expect(browser && recordedCheckNow(browser, live)).toEqual({
    tone: 'failed',
    label: 'Failing now',
    detail: 'Failing now · passed when written',
  });
  expect(unit && recordedCheckNow(unit, live)).toEqual({
    tone: 'passed',
    label: 'Passed',
    detail: 'Passed',
  });
});

it('moves passing checks out of Verified while GitHub now disagrees with what was written', () => {
  const passing = {
    headOid: 'abc1234',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Browser tests', status: 'SUCCESS' }],
  };
  const failing = { ...passing, headOid: 'fed4321' };
  const rows = walkthroughCheckRows(
    [
      { step: 1, checks: passing },
      { step: 2, checks: failing },
    ],
    {
      headSha: 'abc1234',
      checksTruncated: false,
      checks: [
        { name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    },
  );
  expect(rows.changed).toEqual([
    {
      step: 1,
      checks: passing,
      live: {
        tone: 'failed',
        label: 'Failing now',
        names: ['Browser tests'],
        changed: [
          { name: 'Browser tests', tone: 'failed', label: 'Failing now' },
        ],
      },
    },
  ]);
  expect(rows.unchanged).toEqual([{ step: 2, checks: failing }]);
  expect(
    walkthroughCheckRows([{ step: 1, checks: passing }], undefined),
  ).toEqual({ changed: [], unchanged: [{ step: 1, checks: passing }] });
});

it('never keeps checks that failed or were still running when written under Verified', () => {
  const written = (state: string) => ({
    headOid: 'abc1234',
    state,
    checksTruncated: false,
    results: [{ name: 'Browser tests', status: state }],
  });
  const rows = walkthroughCheckRows(
    [
      { step: 1, checks: written('FAILURE') },
      { step: 2, checks: written('PENDING') },
      { step: 3, checks: written('SUCCESS') },
    ],
    undefined,
  );
  expect(rows.changed.map((row) => [row.step, row.live])).toEqual([
    [1, undefined],
    [2, undefined],
  ]);
  expect(rows.unchanged.map((row) => row.step)).toEqual([3]);
});

it('recognizes that the failing check changed even when the overall rollup stayed red', () => {
  const captured = {
    headOid: 'abc1234',
    state: 'FAILURE',
    checksTruncated: false,
    results: [
      { name: 'Build', status: 'FAILURE' },
      { name: 'Browser tests', status: 'SUCCESS' },
    ],
  };
  expect(
    currentWalkthroughChecks(captured, {
      headSha: 'abc1234',
      checksTruncated: false,
      checks: [
        { name: 'Build', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    }),
  ).toEqual({
    tone: 'failed',
    label: 'Failing now',
    names: ['Browser tests'],
    changed: [
      { name: 'Build', tone: 'passed', label: 'Passing now' },
      { name: 'Browser tests', tone: 'failed', label: 'Failing now' },
    ],
  });
});

it('finds the checkout of a pull request by its head branch', () => {
  const projects = [
    {
      id: 'p',
      available: true,
      worktrees: [
        { id: 'main', available: true, branch: 'main' },
        { id: 'gone', available: false, branch: 'feature' },
        { id: 'w', available: true, branch: 'feature' },
      ],
    },
  ];
  expect(pullRequestCheckout(projects, 'p', 'feature')).toEqual({
    projectId: 'p',
    worktreeId: 'w',
  });
  expect(pullRequestCheckout(projects, 'p', 'other')).toBeUndefined();
  expect(pullRequestCheckout(projects, 'q', 'feature')).toBeUndefined();
});

it('notes an undecided call and a call needing a commit only at the pull request head', () => {
  const review = {
    headOid: 'abc',
    undecidedCallStep: 2,
    callsNeedingCommit: [1, 3],
  };
  expect(callNotesAtHead(review, 'abc')).toEqual([
    { step: 2, state: 'is not decided yet' },
    { step: 1, state: 'needs a new commit' },
  ]);
  expect(callNotesAtHead(review, 'def')).toEqual([]);
  expect(callNotesAtHead(undefined, 'abc')).toEqual([]);
  expect(
    callNotesAtHead({ headOid: 'abc', undecidedCallStep: 'reading' }, 'abc'),
  ).toEqual([]);
});

it('names the pinned head in the merge confirmation', () => {
  expect(
    mergeConfirmation({
      number: 57,
      headBranch: 'feature/search',
      baseBranch: 'main',
      headSha: '46b9389f'.padEnd(40, '0'),
    }),
  ).toEqual({
    title: 'Merge pull request #57?',
    description:
      'feature/search at 46b9389 goes into main on GitHub. A merge cannot be undone.',
  });
});

it('leads a step’s checks with what fails now and keeps the written result second', () => {
  const captured = {
    headOid: 'abc1234',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [
      { name: 'Unit tests', status: 'SUCCESS' },
      { name: 'Browser tests', status: 'SUCCESS' },
    ],
  };
  const live = {
    headSha: 'abc1234',
    checksTruncated: false,
    checks: [
      { name: 'Unit tests', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE' },
    ],
  };
  expect(checksHeadline(captured, live)).toEqual({
    tone: 'failed',
    label: 'Failing now',
    names: ['Browser tests'],
    note: 'Passing when written, at abc1234',
  });
  expect(checksHeadline(captured, undefined)).toEqual({
    tone: 'passed',
    label: 'Checks passing at abc1234',
    names: [],
    note: undefined,
  });
});
