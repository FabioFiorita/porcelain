import { describe, expect, it } from 'vite-plus/test';
import {
  approvalHolds,
  assess,
  nextStep,
  reviewComment,
  savedState,
  withState,
  type PullRequest,
  type Review,
  type ReviewFinding,
} from './review-verdict.ts';

const headSha = '0123456789abcdef0123456789abcdef01234567';

function pullRequest(
  paths: readonly string[],
  body = 'Door: two-way',
): PullRequest {
  return {
    repository: 'owner/repo',
    headSha,
    body,
    files: paths.map((filename) => ({ filename })),
  };
}

function finding(priority: ReviewFinding['priority']): ReviewFinding {
  return {
    title: 'Clear the viewer only when the detached handle is current',
    body: 'Detaching an old viewer clears the new one.',
    priority,
    path: 'apps/web/src/features/reviews/store.ts',
    line_start: 256,
    line_end: 257,
  };
}

function review(findings: readonly ReviewFinding[]): Review {
  return { findings, summary: 'Checked the diff.' };
}

const product = ['apps/web/src/features/walkthroughs/view.tsx'];
const none = new Set<string>();
const owner = { lane: 'main' as const, approved: false, owner: true };
function step(
  files: PullRequest['files'],
  options: {
    body?: string;
    labels?: string[];
    owner?: boolean;
    approved?: boolean;
    requestedDecision?: boolean;
    review?: Review;
  } = {},
) {
  const labels = new Set(options.labels);
  return nextStep(
    assess(
      { ...pullRequest(product, options.body), files },
      options.review,
      labels,
      { ...owner, ...options, owner: options.owner ?? true },
    ),
    labels,
  );
}

it('lands the optional API addition, dependency update and ordinary CI command on green checks', () => {
  expect(
    step([
      { filename: 'packages/contracts/src/walkthroughs/api.ts' },
      { filename: 'pnpm-lock.yaml' },
      { filename: 'package.json', patch: '+    "vite": "8.4.0"' },
      { filename: '.github/workflows/ci.yml', patch: '+      - run: vp test' },
    ]),
  ).toMatchObject({ merge: true, add: [] });
});
it.each([
  { filename: 'packages/storage/drizzle/001-drop.sql' },
  { filename: '.github/workflows/ci.yml', patch: '+  contents: write' },
  {
    filename: '.github/workflows/ci.yml',
    patch: '+        env: ${{ secrets.API_KEY }}',
  },
  { filename: '.github/workflows/ci.yml' },
  { filename: 'new.yml', previous_filename: '.github/workflows/release.yml' },
  { filename: 'package.json', patch: '+  "version": "2.0.0"' },
  { filename: 'ci/review-verdict.ts' },
])('asks for approval on a sensitive change %j', (file) => {
  expect(step([file])).toMatchObject({ verdict: 'needs-owner', merge: false });
});
it.each([
  { owner: false },
  { body: 'Door: one-way' },
  { requestedDecision: true },
  { labels: ['decision'] },
])('asks the owner for an outside or consequential change %j', (options) => {
  expect(step([], options).merge).toBe(false);
  expect(
    step([], { ...options, approved: true, labels: ['approved'] }).merge,
  ).toBe(true);
});
it('keeps a hold, actionable findings and old approvals from merging a head', () => {
  expect(step([], { labels: ['hold'] })).toMatchObject({
    merge: false,
    status: 'success',
  });
  expect(
    step([], {
      labels: ['approved'],
      approved: true,
      review: review([finding(2)]),
    }),
  ).toMatchObject({ merge: false, add: ['agent-fixes'] });
  expect(step([], { labels: ['approved', 'decision'] })).toMatchObject({
    merge: false,
    remove: ['approved'],
  });
  expect(
    step([], { review: review([finding(3)]), labels: ['agent-fixes'] }),
  ).toMatchObject({ merge: true, remove: ['agent-fixes'] });
});

describe('release verdict', () => {
  const pull = pullRequest([]);
  const approved = new Set(['approved']);
  const lane = 'release' as const;

  it('keeps P1 through P3 visible as advisory in round three and blocks P0', () => {
    const pull = pullRequest([]);
    const advisory = review([finding(1), finding(2), finding(3)]);
    const state = {
      releaseBase: 'base',
      releaseRound: 3,
      reviewed: { sha: 'earlier', review: advisory, releaseRound: 3 },
    };
    const access = { lane, approved: false, owner: true, releaseRound: 3 };
    const assessment = assess(pull, advisory, none, access);
    expect(nextStep(assessment, none)).toMatchObject({
      status: 'success',
      merge: true,
    });
    const comment = reviewComment(pull, advisory, assessment, state);
    expect(comment).toContain(
      'Release review round **3 of 3**. Only P0 blocks.',
    );
    expect(comment).toContain(
      'The findings are from reviewed commit `earlier`.',
    );
    expect(comment).toContain('/blob/earlier/apps/web/');
    expect(comment).toMatch(/\*\*P1\*\*[\s\S]*\*\*P2\*\*[\s\S]*\*\*P3\*\*/);
    const critical = assess(pull, review([finding(0)]), approved, {
      ...access,
      approved: true,
    });
    expect(nextStep(critical, approved)).toMatchObject({
      status: 'failure',
      merge: false,
    });
  });

  it('passes with a priority 2 finding listed as accepted on the approved head', () => {
    const checked = review([finding(2)]);
    const access = {
      ...owner,
      lane,
      approved: approvalHolds(approved, pull.headSha, headSha),
    };
    const assessment = assess(pull, checked, approved, access);
    expect(nextStep(assessment, approved)).toMatchObject({
      merge: true,
      status: 'success',
    });
    expect(reviewComment(pull, checked, assessment, undefined)).toContain(
      '#### Findings accepted by the owner\n\n- **P2** [Clear the viewer only when the detached handle is current]',
    );
  });

  it.each([
    {
      label: 'without approval',
      priority: 2,
      labels: none,
      approvedHead: undefined,
    },
    {
      label: 'with approval on an older head',
      priority: 2,
      labels: approved,
      approvedHead: 'earlier',
    },
    {
      label: 'with approval of priority 1',
      priority: 1,
      labels: approved,
      approvedHead: headSha,
    },
    {
      label: 'with approval of priority 0',
      priority: 0,
      labels: approved,
      approvedHead: headSha,
    },
  ] as const)('fails $label', ({ priority, labels, approvedHead }) => {
    const checked = review([finding(priority)]);
    const access = {
      ...owner,
      lane,
      approved: approvalHolds(labels, pull.headSha, approvedHead),
    };
    const assessment = assess(pull, checked, labels, access);
    expect(nextStep(assessment, labels)).toMatchObject({
      merge: false,
      status: 'failure',
      verdict: 'needs-fixes',
    });
    expect(reviewComment(pull, checked, assessment, undefined)).not.toContain(
      '#### Findings accepted by the owner',
    );
  });
});

describe('approvalHolds', () => {
  it('counts the approved label only for the commit it was given on', () => {
    const labels = new Set(['approved']);
    expect([
      approvalHolds(labels, headSha, headSha),
      approvalHolds(labels, headSha, 'an-earlier-commit'),
      approvalHolds(new Set<string>(), headSha, headSha),
    ]).toEqual([true, false, false]);
  });
});

describe('withState', () => {
  it('keeps an approval given while CI was still running', () => {
    const earlier = reviewComment(
      pullRequest(product),
      review([]),
      assess(pullRequest(product), review([]), none, owner),
      { reviewed: { sha: 'an-earlier-commit', review: review([]) } },
    );
    const updated = withState(earlier, { approvedHead: headSha });
    const initial = withState(undefined, { approvedHead: headSha });
    expect([savedState(updated), savedState(initial)]).toEqual([
      { approvedHead: headSha },
      { approvedHead: headSha },
    ]);
    expect(updated).toContain('### Ready to merge');
    expect(updated).toContain('- **Reviewer:** Checked the diff.');
    expect(initial).toContain('### Waiting for CI');
  });

  it('saves the reviewed label for its head while CI is still running', () => {
    const initial = withState(undefined, { markedReviewedHead: headSha });
    expect(savedState(initial)).toEqual({ markedReviewedHead: headSha });
    expect(initial).toContain('### Waiting for CI');
  });
});

it('retains the checked commit, its decision, and links actionable findings to the right lines', () => {
  const pull = pullRequest(product);
  const checked = review([finding(2)]);
  const saved = {
    reviewed: { sha: headSha, review: checked },
    decision: { sha: headSha, needsOwner: false },
  };
  const comment = reviewComment(
    pull,
    checked,
    assess(pull, checked, none, owner),
    saved,
  );
  expect(savedState(comment)).toEqual(saved);
  expect(comment).toContain(
    'https://github.com/owner/repo/blob/' +
      headSha +
      '/apps/web/src/features/reviews/store.ts#L256-L257',
  );
});
