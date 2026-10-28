import { expect, it } from 'vitest';
import {
  foundPullRequests,
  githubUnavailable,
  pullRequestChecks,
  pullCheckDuration,
  pullRequestMergeable,
  pullRequestNumber,
  pullRequestRepository,
  pullRequestRollup,
  pullReviewState,
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
] as const)('offers the way out of %s', (reason, kind, label) => {
  expect(githubUnavailable(reason).action).toMatchObject({ kind, label });
});

it('sends a missing account to Settings by name', () => {
  expect(githubUnavailable('no-access').description).toBe(
    'No signed-in account can open this repository. Choose one in Settings › Reviews & Git.',
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

it('finds open pull requests for the branch and names the review holding one', () => {
  const base = {
    title: 'Revoke',
    url: 'https://github.com/a/b/pull/1',
    draft: false,
    updatedAt: '2026-10-27T00:00:00Z',
    checksTruncated: false,
  };
  const pulls = [
    { ...base, number: 1, state: 'open', headBranch: 'feat' },
    {
      ...base,
      number: 2,
      state: 'open',
      headBranch: 'feat',
      reviewId: 'other',
    },
    { ...base, number: 3, state: 'open', headBranch: 'feat', reviewId: 'mine' },
    { ...base, number: 4, state: 'closed', headBranch: 'feat' },
    { ...base, number: 5, state: 'open', headBranch: 'main' },
  ] as const;
  expect(
    foundPullRequests(pulls, 'feat', 'mine').map(({ pull, heldBy }) => [
      pull.number,
      heldBy,
    ]),
  ).toEqual([
    [1, undefined],
    [2, 'other'],
    [3, undefined],
  ]);
});

it.each([
  [undefined, undefined],
  [0, '0s'],
  [4000, '4s'],
  [108000, '1m 48s'],
  [59999, '59s'],
  [3600000, '60m 0s'],
] as const)('formats check duration %s', (duration, expected) => {
  expect(pullCheckDuration(duration)).toBe(expected);
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
    label: '1 of 1 checks failed',
    short: '1 failed',
  });
});

it.each(['QUEUED', 'REQUESTED', 'WAITING', 'PENDING', 'IN_PROGRESS'])(
  'keeps %s checks running',
  (status) => {
    expect(pullRequestChecks([{ name: 'ci', status }], false)).toEqual({
      tone: 'running',
      label: '1 of 1 checks running',
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
