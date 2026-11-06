import { describe, expect, it } from 'vitest';
import {
  assess,
  needsReview,
  reviewComment,
  verdict,
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

describe('verdict', () => {
  it('asks for fixes when the review reports a priority 2 bug, even in a two-way change', () => {
    expect(
      verdict(assess(pullRequest(product), review([finding(2)]), 0.01)),
    ).toBe('needs-fixes');
  });

  it('is ready when only minor notes remain in a two-way product change', () => {
    expect(
      verdict(assess(pullRequest(product), review([finding(3)]), 0.01)),
    ).toBe('ready');
  });

  it('leaves workflow changes to the owner even when the model calls them two-way', () => {
    expect(
      verdict(
        assess(pullRequest(['.github/workflows/ci.yml']), review([]), 0.01),
      ),
    ).toBe('needs-owner');
  });

  it('treats an agent instruction file in any folder as protected', () => {
    expect(
      verdict(assess(pullRequest(['apps/web/AGENTS.md']), review([]), 0.01)),
    ).toBe('needs-owner');
  });

  it('leaves a change the model reads as one-way to the owner', () => {
    expect(verdict(assess(pullRequest(product), review([]), 0.9))).toBe(
      'needs-owner',
    );
  });

  it('respects the description declaring a one-way door', () => {
    expect(
      verdict(assess(pullRequest(product, 'Door: one-way'), review([]), 0.01)),
    ).toBe('needs-owner');
  });
});

const reviewNeeded = { reviewProbability: 0.97, requested: false };

describe('needsReview', () => {
  it('skips the review when Triage finds nothing to read', () => {
    expect(needsReview({ reviewProbability: 0.08, requested: false })).toBe(
      false,
    );
  });

  it('reviews when Triage declines to answer', () => {
    expect(
      needsReview({ reviewProbability: undefined, requested: false }),
    ).toBe(true);
  });

  it('reviews whenever the label asks, whatever Triage thinks', () => {
    expect(needsReview({ reviewProbability: 0.08, requested: true })).toBe(
      true,
    );
  });
});

describe('reviewComment', () => {
  it('links each finding to its lines at the reviewed commit', () => {
    const comment = reviewComment(
      pullRequest(product),
      reviewNeeded,
      review([finding(2)]),
      assess(pullRequest(product), review([finding(2)]), 0.01),
    );
    expect(comment).toContain(
      `[Clear the viewer only when the detached handle is current](https://github.com/owner/repo/blob/${headSha}/apps/web/src/features/reviews/store.ts#L256-L257)`,
    );
  });

  it('names the disagreement between the description and Doorkeeper', () => {
    const comment = reviewComment(
      pullRequest(product),
      reviewNeeded,
      review([]),
      assess(pullRequest(product), review([]), 0.8),
    );
    expect(comment).toContain(
      'The description declares a two-way door, but Doorkeeper reads it as one-way',
    );
  });

  it('says who decided what when Triage skips the review', () => {
    const comment = reviewComment(
      pullRequest(['README.md']),
      { reviewProbability: 0.08, requested: false },
      undefined,
      assess(pullRequest(['README.md']), undefined, 0.02),
    );
    expect(comment).toContain(
      `### Ready to merge once CI is green\n\nJudged commit \`${headSha.slice(0, 12)}\`.\n\n- **Triage:** no review needed (probability 0.08). Add the \`agent-review\` label to review it anyway.\n- **Doorkeeper:** two-way door (probability 0.02).`,
    );
    expect(comment).not.toContain('**Reviewer:**');
  });
});
