import { describe, expect, it } from 'vitest';
import {
  assess,
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

describe('reviewComment', () => {
  it('links each finding to its lines at the reviewed commit', () => {
    const comment = reviewComment(
      pullRequest(product),
      review([finding(2)]),
      assess(pullRequest(product), review([finding(2)]), 0.01),
      'gpt-6.1-sol',
    );
    expect(comment).toContain(
      `[Clear the viewer only when the detached handle is current](https://github.com/owner/repo/blob/${headSha}/apps/web/src/features/reviews/store.ts#L256-L257)`,
    );
  });

  it('names the disagreement when the description says two-way but the change reads one-way', () => {
    const comment = reviewComment(
      pullRequest(product),
      review([]),
      assess(pullRequest(product), review([]), 0.8),
      'gpt-6.1-sol',
    );
    expect(comment).toContain(
      'The description declares a two-way door, but the change reads as one-way',
    );
  });
});
