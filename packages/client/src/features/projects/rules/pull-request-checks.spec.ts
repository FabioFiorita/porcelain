import { expect, it } from 'vite-plus/test';
import {
  pullStatusView,
  toggledKey,
  checkDurationLabel,
  checkLogUnavailable,
  failedJobsRerunRequest,
  jobRerunRequest,
  checkNameInGroup,
  checkProgress,
  checkState,
  groupChecks,
  jobRerunOffer,
  failedJobsRerunOffer,
  nextPollDelay,
  pullRequestBlockers,
  rerunsStillPending,
  type PullCheck,
  type PullStatus,
} from './pull-request-checks.ts';
import {
  mergeButtonReason,
  mergeReadiness,
  walkthroughStanding,
} from './merge-readiness.ts';
import {
  pullRequestMergeBlock,
  type PullRequestMergeReview,
} from './pull-request.ts';

function job(
  name: string,
  state: 'passed' | 'failed' | 'running',
  extra: Partial<PullCheck> = {},
): PullCheck {
  return {
    key: `actions:${extra.group ?? 'CI'}:${name}`,
    kind: 'actions',
    name,
    status: state === 'running' ? 'IN_PROGRESS' : 'COMPLETED',
    conclusion: { passed: 'SUCCESS', failed: 'FAILURE', running: undefined }[
      state
    ],
    group: 'CI',
    runId: 1,
    jobId: name.length,
    required: false,
    steps: [],
    annotations: [],
    ...extra,
  };
}

function pull(
  checks: PullCheck[],
  extra: Partial<PullStatus> = {},
): PullStatus {
  return {
    number: 7,
    state: 'open',
    draft: false,
    headSha: 'a'.repeat(40),
    mergeable: 'MERGEABLE',
    mergeState: 'CLEAN',
    reviewDecision: undefined,
    requestedReviewers: [],
    canRerun: true,
    checks,
    checksTruncated: false,
    checksSummary: undefined,
    ...extra,
  };
}

it('groups by run, failed groups first, and splits each group by outcome', () => {
  const groups = groupChecks([
    job('Docs', 'passed', { group: 'Docs', runId: 2, runNumber: 812 }),
    job('Lint', 'passed'),
    job('Unit', 'failed'),
    job('Deploy', 'running', { group: 'Deploy', runId: 3 }),
    {
      ...job('reviewdog', 'failed'),
      key: 'check:reviewdog:reviewdog',
      kind: 'check',
      group: 'reviewdog',
      runId: undefined,
      jobId: undefined,
    },
    job('Lint', 'passed', { key: 'actions:CI:Lint again', runId: 4 }),
  ]);
  expect(
    groups.map((group) => [
      group.name,
      group.runId,
      group.runNumber,
      group.state,
      group.failed.map((check) => check.name),
      group.running.map((check) => check.name),
      group.passed.map((check) => check.name),
    ]),
  ).toEqual([
    ['CI', 1, undefined, 'failed', ['Unit'], [], ['Lint']],
    ['reviewdog', undefined, undefined, 'failed', ['reviewdog'], [], []],
    ['Deploy', 3, undefined, 'running', [], ['Deploy'], []],
    ['Docs', 2, 812, 'passed', [], [], ['Docs']],
    ['CI', 4, undefined, 'passed', [], [], ['Lint']],
  ]);
});

it('reports the running step as its position among the steps', () => {
  const step = (number: number, status: string, conclusion?: string) => ({
    number,
    name: `Step ${number}`,
    status,
    conclusion,
  });
  const check = job('Integration', 'running', {
    steps: [
      step(1, 'COMPLETED', 'SUCCESS'),
      step(2, 'COMPLETED', 'SKIPPED'),
      step(3, 'IN_PROGRESS'),
      step(4, 'PENDING'),
    ],
  });
  expect(checkProgress(check)).toMatchObject({
    position: 3,
    total: 4,
    step: { name: 'Step 3' },
  });
  expect(checkProgress(job('Done', 'passed'))).toBeUndefined();
  expect(checkProgress(job('Queued', 'running'))).toBeUndefined();
});

it('names what blocks a merge in plain words and links checks to their rows', () => {
  const failing = job('Browser tests', 'failed', {
    required: true,
    steps: [
      {
        number: 1,
        name: 'Set up job',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      },
      {
        number: 6,
        name: 'Run tests',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
      },
    ],
  });
  const running = job('Integration', 'running', {
    steps: [
      { number: 1, name: 'Set up', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { number: 2, name: 'Run', status: 'IN_PROGRESS' },
    ],
  });
  expect(
    pullRequestBlockers(
      pull([failing, running, job('Lint', 'passed')], {
        mergeable: 'CONFLICTING',
        reviewDecision: 'REVIEW_REQUIRED',
        requestedReviewers: ['octo', 'org/platform', 'hubot'],
      }),
      'main',
    ),
  ).toEqual([
    { key: 'conflicts', tone: 'failed', text: 'Conflicts with main.' },
    {
      key: 'check:actions:CI:Browser tests',
      tone: 'failed',
      checkKey: 'actions:CI:Browser tests',
      text: 'Browser tests (required) failed at step 6: Run tests.',
    },
    {
      key: 'running',
      tone: 'running',
      checkKey: 'actions:CI:Integration',
      text: 'Integration is running, step 2 of 2.',
    },
    {
      key: 'review',
      tone: 'none',
      text: 'Review required from octo, org/platform and 1 more.',
    },
  ]);
});

it('explains a draft, a branch behind its base and a bare branch rule', () => {
  expect(
    pullRequestBlockers(
      pull([], { draft: true, mergeState: 'BEHIND' }),
      'main',
    ).map((blocker) => blocker.text),
  ).toEqual([
    'Draft. Mark it ready for review on GitHub.',
    'Behind main. Update the branch before merging.',
  ]);
  expect(
    pullRequestBlockers(pull([], { mergeState: 'BLOCKED' }), 'main').map(
      (blocker) => blocker.text,
    ),
  ).toEqual(['A branch rule on GitHub blocks the merge.']);
  expect(pullRequestBlockers(pull([]), 'main')).toEqual([]);
  expect(
    pullRequestBlockers(pull([]), 'main', []).map((blocker) => blocker.text),
  ).toEqual(['This repository allows no merge method.']);
  expect(
    pullRequestBlockers(
      pull([job('x', 'failed')], { state: 'merged' }),
      'main',
    ),
  ).toEqual([]);
});

it('polls from 20 seconds and backs off by half up to two minutes while nothing changes', () => {
  const delays: number[] = [];
  let delay: number | undefined;
  for (let poll = 0; poll < 7; poll++) {
    delay = nextPollDelay(delay, false);
    delays.push(delay);
  }
  expect(delays).toEqual([
    20_000, 30_000, 45_000, 67_500, 101_250, 120_000, 120_000,
  ]);
  expect(nextPollDelay(120_000, true)).toBe(20_000);
});

it('offers a re-run only for finished Actions jobs the account may re-run', () => {
  const failed = job('Unit', 'failed');
  const passed = job('Lint', 'passed');
  const status = pull([failed, passed]);
  expect(jobRerunOffer(status, failed)).toEqual({
    kind: 'available',
    confirm: false,
  });
  expect(jobRerunOffer(status, passed)).toEqual({
    kind: 'available',
    confirm: true,
  });
  expect(jobRerunOffer(pull([passed]), passed)).toEqual({
    kind: 'available',
    confirm: false,
  });
  expect(
    jobRerunOffer(pull([failed], { canRerun: false }), failed),
  ).toMatchObject({
    kind: 'unavailable',
    reason: 'Your GitHub account cannot re-run workflows in this repository.',
  });
  expect(
    jobRerunOffer(pull([failed, job('Deploy', 'running')]), failed),
  ).toMatchObject({
    kind: 'unavailable',
    reason: 'GitHub re-runs a workflow only after all of its jobs finish.',
  });
  const external = { ...failed, kind: 'check' as const, jobId: undefined };
  expect(jobRerunOffer(pull([external]), external)).toMatchObject({
    kind: 'unavailable',
  });
  const [group] = groupChecks(status.checks);
  expect(group && failedJobsRerunOffer(status, group)).toEqual({
    kind: 'available',
    confirm: false,
  });
  const [clean] = groupChecks([passed]);
  expect(clean && failedJobsRerunOffer(pull([passed]), clean)).toBeUndefined();
});

it('keeps a requested re-run pending until GitHub shows a new attempt or three minutes pass', () => {
  const requested = [{ key: 'actions:CI:Unit', jobId: 4, at: 1_000 }];
  const failed = pull([job('Unit', 'failed')]);
  expect(rerunsStillPending(failed, requested, 2_000)).toEqual(requested);
  expect(rerunsStillPending(failed, requested, 1_000 + 180_000)).toEqual(
    requested,
  );
  expect(rerunsStillPending(failed, requested, 1_000 + 180_001)).toEqual([]);
  expect(
    rerunsStillPending(pull([job('Unit', 'running')]), requested, 2_000),
  ).toEqual([]);
  expect(
    rerunsStillPending(
      pull([job('Unit', 'failed', { jobId: 99 })]),
      requested,
      2_000,
    ),
  ).toEqual([]);
});

it('formats durations in seconds, minutes and hours', () => {
  expect(checkDurationLabel(undefined)).toBeUndefined();
  expect(checkDurationLabel(4_000)).toBe('4s');
  expect(checkDurationLabel(108_000)).toBe('1m 48s');
  expect(checkDurationLabel(3_600_000)).toBe('1h 0m');
});

it('treats an expected status as still running', () => {
  expect(checkState({ status: 'COMPLETED', conclusion: 'EXPECTED' })).toBe(
    'running',
  );
  expect(checkState({ status: 'COMPLETED', conclusion: 'NEUTRAL' })).toBe(
    'skipped',
  );
});

it('asks to re-run only the failed Actions jobs of a workflow run', () => {
  const [group] = groupChecks([
    job('unit', 'failed', { runId: 9, group: 'CI' }),
    job('lint', 'failed', { runId: 9, group: 'CI' }),
    job('build', 'passed', { runId: 9, group: 'CI' }),
  ]);
  expect(group && failedJobsRerunRequest(group)).toEqual({
    title: 'Re-run 2 failed jobs in CI?',
    description:
      'GitHub starts a new attempt of the failed jobs and of the jobs that depend on them.',
    target: { kind: 'failed-jobs', runId: 9 },
    keys: ['actions:CI:unit', 'actions:CI:lint'],
  });
  const [external] = groupChecks([
    job('vercel', 'failed', { kind: 'check', runId: undefined }),
  ]);
  expect(external && failedJobsRerunRequest(external)).toBeUndefined();
});

it('asks to re-run one job by its id, and nothing without one', () => {
  expect(jobRerunRequest(job('unit', 'failed', { jobId: 31 }))).toMatchObject({
    title: 'Re-run unit?',
    target: { kind: 'job', jobId: 31 },
    keys: ['actions:CI:unit'],
  });
  expect(
    jobRerunRequest(job('unit', 'failed', { jobId: undefined })),
  ).toBeUndefined();
});

it('explains a missing job log in one sentence', () => {
  expect(checkLogUnavailable('log-too-large')).toBe(
    'The job log is larger than 16 MB.',
  );
  expect(checkLogUnavailable('offline')).toBe('GitHub did not return the log.');
});

it('keeps a requested re-run pending while a read is in flight', () => {
  const status = pull([job('unit', 'failed', { jobId: 31 })]);
  const requested = [{ key: 'actions:CI:unit', jobId: 31, at: 1_000 }];
  const view = (waiting: boolean) =>
    pullStatusView({
      watch: { status, problem: undefined, pending: [], readAt: 2_000 },
      failed: false,
      waiting,
      requested,
    });
  expect([...view(true).pendingReruns]).toEqual(['actions:CI:unit']);
  expect([...view(false).pendingReruns]).toEqual([]);
});

it('reports a failed first read as failed, and a later problem as itself', () => {
  const view = pullStatusView({
    watch: undefined,
    failed: true,
    waiting: false,
    requested: [],
  });
  expect(view).toMatchObject({ status: undefined, problem: 'failed' });
  expect(
    pullStatusView({
      watch: {
        status: undefined,
        problem: 'rate-limited',
        pending: [],
        readAt: 0,
      },
      failed: false,
      waiting: false,
      requested: [],
    }).problem,
  ).toBe('rate-limited');
});

it('toggles one key without changing the set it was given', () => {
  const open = new Set(['a']);
  expect([...toggledKey(open, 'b')]).toEqual(['a', 'b']);
  expect([...toggledKey(open, 'a')]).toEqual([]);
  expect([...open]).toEqual(['a']);
});

const head = 'a'.repeat(40);

const decided: PullRequestMergeReview = {
  headOid: head,
  undecidedCallStep: undefined,
  undecidedCalls: 0,
};

function buttonBlock(
  live: PullStatus,
  review: PullRequestMergeReview | undefined,
) {
  return pullRequestMergeBlock(
    { ...live, baseBranch: 'main', checksSummary: live.checksSummary },
    review,
  );
}

it('lists every reason the pull request cannot merge and which of them hold the Merge button', () => {
  const readiness = mergeReadiness({
    status: pull(
      [
        job('Browser tests', 'failed'),
        job('Lint', 'failed'),
        job('Server', 'running'),
      ],
      { reviewDecision: 'REVIEW_REQUIRED' },
    ),
    baseBranch: 'main',
    review: { headOid: head, undecidedCallStep: 1, undecidedCalls: 1 },
  });
  expect(readiness).toMatchObject({
    tone: 'failed',
    label:
      'Not ready to merge: 2 checks failing, 1 check running, review required, 1 call open',
    waitsFor:
      'Merge waits for: 2 checks failing, 1 check running, review required, 1 call open.',
  });
});

it('says ready only when GitHub lists nothing and every call is decided', () => {
  const live = pull([job('Unit tests', 'passed')]);
  const readiness = mergeReadiness({
    status: live,
    baseBranch: 'main',
    review: decided,
  });
  expect(readiness).toEqual({
    tone: 'ready',
    label: 'Ready to merge',
    reasons: [],
    waitsFor: undefined,
  });
  expect(pullRequestBlockers(live, 'main')).toEqual([]);
  expect(buttonBlock(live, decided)).toBeUndefined();
});

it.each([
  ['a failed check', pull([job('Unit tests', 'failed')]), decided, true],
  ['a running check', pull([job('Unit tests', 'running')]), decided, true],
  ['a draft', pull([], { draft: true }), decided, true],
  ['a conflict', pull([], { mergeable: 'CONFLICTING' }), decided, true],
  [
    'a branch behind its base',
    pull([], { mergeState: 'BEHIND' }),
    decided,
    false,
  ],
  [
    'requested changes',
    pull([], { reviewDecision: 'CHANGES_REQUESTED' }),
    decided,
    true,
  ],
  [
    'a required review',
    pull([], { reviewDecision: 'REVIEW_REQUIRED' }),
    decided,
    true,
  ],
  ['a branch rule', pull([], { mergeState: 'BLOCKED' }), decided, false],
  [
    'more checks than GitHub lists',
    pull([job('Unit tests', 'passed')], { checksTruncated: true }),
    decided,
    false,
  ],
  [
    'calls still being read',
    pull([]),
    { headOid: head, undecidedCallStep: 'reading' },
    true,
  ],
  [
    'calls that could not be read',
    pull([]),
    { headOid: head, undecidedCallStep: 'unreadable' },
    true,
  ],
  [
    'open calls',
    pull([]),
    { headOid: head, undecidedCallStep: 2, undecidedCalls: 2 },
    true,
  ],
  [
    'a Walkthrough for another commit',
    pull([]),
    { ...decided, headOid: 'b'.repeat(40) },
    false,
  ],
  [
    'a call decided against the change',
    pull([]),
    { ...decided, callsNeedingCommit: [1] },
    true,
  ],
] satisfies [string, PullStatus, PullRequestMergeReview, boolean][])(
  'never says ready with %s, and says whether it holds the Merge button',
  (_case, live, review, holds) => {
    const readiness = mergeReadiness({
      status: live,
      baseBranch: 'main',
      review,
    });
    expect(readiness.label).toMatch(/^Not ready to merge: \S/);
    expect(readiness.waitsFor !== undefined).toBe(holds);
  },
);

it.each([
  ['CHANGES_REQUESTED', 'changes requested'],
  ['REVIEW_REQUIRED', 'review required'],
] as const)(
  'holds Merge while GitHub reports %s, even with every check passing',
  (reviewDecision, text) => {
    expect(
      mergeReadiness({
        status: pull([job('Unit tests', 'passed')], { reviewDecision }),
        baseBranch: 'main',
        review: decided,
      }).waitsFor,
    ).toBe(`Merge waits for: ${text}.`);
  },
);

it('names the open calls and a Walkthrough written for another commit', () => {
  expect(
    mergeReadiness({
      status: pull([]),
      baseBranch: 'main',
      review: { headOid: head, undecidedCallStep: 1, undecidedCalls: 2 },
    }).label,
  ).toBe('Not ready to merge: 2 calls open');
  expect(
    mergeReadiness({
      status: pull([]),
      baseBranch: 'main',
      review: { ...decided, headOid: 'b'.repeat(40) },
    }),
  ).toMatchObject({
    tone: 'waiting',
    label: 'Not ready to merge: the Walkthrough is for another commit',
    waitsFor: undefined,
  });
});

it('holds Merge while a call is decided against what the change does, until a new commit lands', () => {
  const live = pull([job('Unit tests', 'passed')]);
  expect(
    mergeReadiness({
      status: live,
      baseBranch: 'main',
      review: { ...decided, callsNeedingCommit: [2] },
    }),
  ).toMatchObject({
    tone: 'waiting',
    label: 'Not ready to merge: 1 call needs a new commit',
    waitsFor: 'Merge waits for: 1 call needs a new commit.',
  });
  expect(buttonBlock(live, { ...decided, callsNeedingCommit: [2] })).toBe(
    'Your call in step 2 needs a new commit.',
  );
  expect(
    mergeReadiness({
      status: live,
      baseBranch: 'main',
      review: {
        headOid: head,
        undecidedCallStep: 1,
        undecidedCalls: 1,
        callsNeedingCommit: [2, 3],
      },
    }).waitsFor,
  ).toBe('Merge waits for: 1 call open, 2 calls need a new commit.');
  const moved = {
    ...decided,
    headOid: 'b'.repeat(40),
    callsNeedingCommit: [2],
  };
  expect(
    mergeReadiness({ status: live, baseBranch: 'main', review: moved }),
  ).toMatchObject({
    label: 'Not ready to merge: the Walkthrough is for another commit',
    waitsFor: undefined,
  });
  expect(buttonBlock(live, moved)).toBeUndefined();
});

it('lets a call decided for what the change does, or with no such option, merge', () => {
  const live = pull([job('Unit tests', 'passed')]);
  const review = { ...decided, callsNeedingCommit: [] };
  expect(
    mergeReadiness({ status: live, baseBranch: 'main', review }),
  ).toMatchObject({ tone: 'ready', waitsFor: undefined });
  expect(buttonBlock(live, review)).toBeUndefined();
});

it('reports an unread, merged or closed pull request without a verdict', () => {
  expect(
    mergeReadiness({ status: undefined, baseBranch: 'main' }),
  ).toMatchObject({ tone: 'unknown', label: 'Reading the merge status' });
  expect(
    mergeReadiness({
      status: pull([], { state: 'merged' }),
      baseBranch: 'main',
    }).label,
  ).toBe('Merged');
  expect(
    mergeReadiness({
      status: pull([], { state: 'closed' }),
      baseBranch: 'main',
    }).label,
  ).toBe('Closed without merging');
});

const detail = { state: 'open', draft: false, baseBranch: 'main' };

it('stands behind the merge rule at the top of the Walkthrough, with the pull request state', () => {
  expect(
    walkthroughStanding({
      pull: {
        status: pull([job('Browser tests', 'failed')], { draft: true }),
        statusUnread: false,
        detail,
      },
      review: { headOid: head, undecidedCallStep: 1, undecidedCalls: 1 },
    }),
  ).toEqual({
    label: 'Not ready to merge: draft, 1 check failing, 1 call open',
    icon: 'failed',
    quiet: false,
    pullState: 'Draft',
  });
  expect(
    walkthroughStanding({
      pull: {
        status: pull([job('Unit tests', 'passed')]),
        statusUnread: false,
        detail,
      },
      review: decided,
    }),
  ).toMatchObject({
    label: 'Ready to merge',
    icon: 'passed',
    pullState: 'Open',
  });
});

it('counts only open calls when there is no pull request or its status cannot be read', () => {
  const calls = { headOid: head, undecidedCallStep: 2, undecidedCalls: 2 };
  expect(walkthroughStanding({ pull: undefined, review: calls })).toEqual({
    label: '2 calls open',
    icon: 'none',
    quiet: false,
    pullState: undefined,
  });
  expect(
    walkthroughStanding({
      pull: { status: undefined, statusUnread: true, detail },
      review: calls,
    }),
  ).toMatchObject({ label: '2 calls open', pullState: 'Open' });
  expect(walkthroughStanding({ pull: undefined, review: decided })).toBe(
    undefined,
  );
  expect(
    walkthroughStanding({
      pull: { status: undefined, statusUnread: false, detail },
      review: decided,
    }),
  ).toMatchObject({ label: 'Reading the merge status', quiet: true });
});

it('holds the Merge button for every merge rule reason, reviews included', () => {
  expect(
    mergeButtonReason(undefined, 'Merge waits for: review required.'),
  ).toBe('Merge waits for: review required.');
  expect(
    mergeButtonReason(
      'Decide the call first.',
      'Merge waits for: 1 call open.',
    ),
  ).toBe('Merge waits for: 1 call open.');
  expect(mergeButtonReason('Decide the call first.', undefined)).toBe(
    'Decide the call first.',
  );
  expect(mergeButtonReason(undefined, undefined)).toBeUndefined();
});

it('names a check under its group without repeating the group name before it', () => {
  expect(
    checkNameInGroup({ name: 'reviewdog / eslint', group: 'reviewdog' }),
  ).toBe('eslint');
  expect(checkNameInGroup({ name: 'Browser tests', group: 'CI' })).toBe(
    'Browser tests',
  );
  expect(checkNameInGroup({ name: 'reviewdog', group: 'reviewdog' })).toBe(
    'reviewdog',
  );
  expect(
    checkNameInGroup({ name: 'reviewdog-lint / eslint', group: 'reviewdog' }),
  ).toBe('reviewdog-lint / eslint');
});
