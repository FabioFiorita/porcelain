import { describe, expect, it } from 'vitest';
import {
  assess,
  needsReview,
  nextStep,
  reviewComment,
  savedState,
  type PullRequest,
  type Review,
  type ReviewFinding,
} from './review-verdict.ts';

const headSha = '0123456789abcdef0123456789abcdef01234567';

function pullRequest(
  paths: readonly string[],
  body = 'Door: two-way',
): PullRequest {
  return { repository: 'owner/repo', headSha, body, paths };
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

const product = ['apps/web/src/features/reviews/store.ts'];
const none = new Set<string>();

function step(
  paths: readonly string[],
  findings: readonly ReviewFinding[] | undefined,
  oneWay: number,
  labels: ReadonlySet<string> = none,
  body?: string,
) {
  const reviewed = findings === undefined ? undefined : review(findings);
  return nextStep(
    assess(pullRequest(paths, body), reviewed, oneWay, labels),
    reviewed !== undefined,
    labels,
  );
}

describe('nextStep', () => {
  it('merges a reviewed two-way change with only minor notes', () => {
    expect(step(product, [finding(3)], 0.01)).toEqual({
      verdict: 'ready',
      status: 'success',
      description: 'Ready: merging once CI is green',
      add: ['agent-review'],
      remove: [],
      merge: true,
    });
  });

  it('merges a change Triage left unreviewed when Doorkeeper calls it two-way', () => {
    expect(step(['README.md'], undefined, 0.02).merge).toBe(true);
  });

  it('holds back a priority 2 bug for the agent to fix, even in a two-way change', () => {
    expect(step(product, [finding(2)], 0.01)).toMatchObject({
      verdict: 'needs-fixes',
      status: 'failure',
      add: ['agent-review', 'agent-fixes'],
      merge: false,
    });
  });

  it('clears the fixes label once the next review is clean', () => {
    expect(
      step(product, [], 0.01, new Set(['agent-review', 'agent-fixes'])),
    ).toMatchObject({ add: [], remove: ['agent-fixes'], merge: true });
  });

  it('waits for the owner on workflow changes even when Doorkeeper calls them two-way', () => {
    expect(step(['.github/workflows/ci.yml'], undefined, 0.01)).toMatchObject({
      verdict: 'needs-owner',
      add: ['decision'],
      merge: false,
    });
  });

  it('treats an agent instruction file in any folder as the owner’s call', () => {
    expect(step(['apps/web/AGENTS.md'], undefined, 0.01).verdict).toBe(
      'needs-owner',
    );
  });

  it('waits for the owner when Doorkeeper reads a one-way door', () => {
    expect(step(product, [], 0.9).verdict).toBe('needs-owner');
  });

  it('waits for the owner when the description declares a one-way door', () => {
    expect(step(product, [], 0.01, none, 'Door: one-way').verdict).toBe(
      'needs-owner',
    );
  });

  it('keeps a decision label someone added by hand until the owner approves', () => {
    expect(step(product, [], 0.01, new Set(['decision'])).merge).toBe(false);
  });

  it('merges a one-way change once the owner approves it', () => {
    expect(
      step(
        ['package.json'],
        undefined,
        0.99,
        new Set(['decision', 'approved']),
      ),
    ).toMatchObject({ verdict: 'ready', add: [], merge: true });
  });

  it('never lets approval override a bug the Reviewer found', () => {
    expect(
      step(product, [finding(1)], 0.01, new Set(['approved'])).verdict,
    ).toBe('needs-fixes');
  });

  it('passes the check but does not merge while the hold label is on', () => {
    expect(step(product, [], 0.01, new Set(['hold']))).toMatchObject({
      status: 'success',
      description: 'Ready, but the hold label keeps it from merging',
      merge: false,
    });
  });
});

describe('needsReview', () => {
  it('skips the review when Triage finds nothing to read', () => {
    expect(needsReview({ reviewProbability: 0.08, requested: false })).toBe(
      false,
    );
  });

  it('reviews when Triage could not judge the patch', () => {
    expect(
      needsReview({ reviewProbability: undefined, requested: false }),
    ).toBe(true);
  });

  it('keeps reviewing every push once the label is on', () => {
    expect(needsReview({ reviewProbability: 0.08, requested: true })).toBe(
      true,
    );
  });
});

describe('reviewComment', () => {
  it('saves the review so the next push is reviewed from where it stopped', () => {
    const saved = { reviewed: headSha, review: review([finding(2)]) };
    const comment = reviewComment(
      pullRequest(product),
      { reviewProbability: 0.97, requested: false },
      saved.review,
      assess(pullRequest(product), saved.review, 0.01, none),
      saved,
    );
    expect(savedState(comment)).toEqual(saved);
  });

  it('links each finding to its lines at the reviewed commit', () => {
    const comment = reviewComment(
      pullRequest(product),
      { reviewProbability: 0.97, requested: false },
      review([finding(2)]),
      assess(pullRequest(product), review([finding(2)]), 0.01, none),
      undefined,
    );
    expect(comment).toContain(
      `[Clear the viewer only when the detached handle is current](https://github.com/owner/repo/blob/${headSha}/apps/web/src/features/reviews/store.ts#L256-L257)`,
    );
  });

  it('says who decided what when Triage skips the review', () => {
    const comment = reviewComment(
      pullRequest(['README.md']),
      { reviewProbability: 0.08, requested: false },
      undefined,
      assess(pullRequest(['README.md']), undefined, 0.02, none),
      undefined,
    );
    expect(comment).toContain(
      `### Ready to merge\n\nJudged commit \`${headSha.slice(0, 12)}\`.\n\n- **Triage:** no review needed (probability 0.08).\n- **Doorkeeper:** two-way door (probability 0.02).`,
    );
    expect(comment).not.toContain('**Reviewer:**');
  });
});
