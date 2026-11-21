import { describe, expect, it } from 'vitest';
import { judgeReview, type JudgmentHost } from './review-judgment.ts';
import {
  assess,
  nextStep,
  reviewComment,
  type ReviewedCommit,
} from './review-verdict.ts';

const headSha = '0123456789abcdef0123456789abcdef01234567';
const patch = '+import { connect } from "new-storage-driver";';
const cleanReview = { findings: [], summary: 'No actionable bugs found.' };

function scenario(
  options: {
    triageProbability?: number;
    ownerProbability?: number;
    requested?: boolean;
    markedReviewedHead?: string;
    previous?: ReviewedCommit | undefined;
    patch?: string;
  } = {},
) {
  const timeline: string[] = [];
  const evidence: string[] = [];
  const host: JudgmentHost = {
    decide: async (question) => {
      timeline.push(question.name);
      evidence.push(question.evidence);
      return question.name === 'needs_review'
        ? (options.triageProbability ?? 0.92)
        : (options.ownerProbability ?? 0.9);
    },
    review: async () => {
      timeline.push('Review API');
      return cleanReview;
    },
    report: (description) => timeline.push(description),
  };
  const input = {
    evidence: 'Description: Door: two-way. No new dependency.',
    readPatch: () => options.patch ?? patch,
    requested: options.requested ?? false,
    markedReviewedHead: options.markedReviewedHead,
    previous: options.previous,
    headSha,
  };
  return { host, input, timeline, evidence };
}

const pullRequest = {
  repository: 'owner/repo',
  headSha,
  body: 'Door: two-way',
  paths: ['apps/web/src/storage.ts'],
};

const none = new Set<string>();

function outcome(result: Awaited<ReturnType<typeof judgeReview>>) {
  const assessment = assess(
    pullRequest,
    result.review,
    result.ownerApprovalProbability,
    none,
    { approved: false, trusted: true },
  );
  return {
    step: nextStep(assessment, result.review !== undefined, none),
    comment: reviewComment(
      pullRequest,
      result.triage,
      result.review,
      assessment,
      undefined,
    ),
  };
}

describe('review judgment', () => {
  it('reports an owner’s single browser spec without requiring model access or the patch', async () => {
    const run = scenario();
    const result = await judgeReview(
      {
        ...run.input,
        routineWebSpec: 'spec/e2e/projects-manual-selection.e2e.ts',
        readPatch: () => {
          throw new Error('Routine judgment read the patch');
        },
      },
      run.host,
    );
    expect(run.timeline).toEqual([
      'Routine browser spec: spec/e2e/projects-manual-selection.e2e.ts',
    ]);
    expect(outcome(result).step).toMatchObject({
      status: 'success',
      merge: true,
    });
    expect(outcome(result).comment).toContain('**Approval policy:**');
  });

  it.each([
    { requested: true },
    { previous: { sha: 'earlier', review: cleanReview } },
  ])(
    'keeps a requested or continued review on the full path %j',
    async (options) => {
      const run = scenario(options);
      await judgeReview(
        { ...run.input, routineWebSpec: 'spec/e2e/app-routing.e2e.ts' },
        run.host,
      );
      expect(run.timeline).toContain('Review API');
      expect(run.timeline).toContain('needs_owner_approval');
    },
  );

  it('shows each stage before its API operation and requires approval despite a two-way declaration', async () => {
    const run = scenario();
    const result = await judgeReview(run.input, run.host);
    expect(run.timeline).toEqual([
      'needs_review',
      'Triage: needs a review (probability 0.92)',
      'Reviewer: needs a review (probability 0.92)',
      'Review API',
      'Doorkeeper: checking whether owner approval is required',
      'needs_owner_approval',
    ]);
    expect(run.evidence[1]).toContain(
      '+import { connect } from "new-storage-driver";',
    );
    expect(run.evidence[1]).toContain('No new dependency.');
    expect(run.evidence[1]).toContain(
      "Reviewer's summary: No actionable bugs found.",
    );
    expect(outcome(result).step).toMatchObject({
      verdict: 'needs-owner',
      merge: false,
    });
    expect(outcome(result).comment).toContain(
      '**Doorkeeper:** owner approval required (probability 0.90)',
    );
  });

  it('still gives Doorkeeper the patch when Triage skips the Reviewer', async () => {
    const run = scenario({ triageProbability: 0.08, ownerProbability: 0.02 });
    const result = await judgeReview(run.input, run.host);
    expect(result.review).toBeUndefined();
    expect(run.timeline).toEqual([
      'needs_review',
      'Triage: no review needed (probability 0.08)',
      'Doorkeeper: checking whether owner approval is required',
      'needs_owner_approval',
    ]);
    expect(run.evidence[1]).toContain(patch);
    expect(outcome(result).step.merge).toBe(true);
  });

  it('explains an explicit review request and sends Doorkeeper the patch', async () => {
    const run = scenario({ requested: true });
    const result = await judgeReview(run.input, run.host);
    expect(run.timeline).not.toContain('needs_review');
    expect(run.evidence[0]).toContain(patch);
    expect(outcome(result).comment).toContain(
      'review explicitly requested with the agent-review label',
    );
  });

  it.each([undefined, { sha: 'earlier', review: cleanReview }])(
    'asks only Doorkeeper on the marked head with review history %j',
    async (previous) => {
      const run = scenario({ markedReviewedHead: headSha, previous });
      const result = await judgeReview(run.input, run.host);
      expect(run.timeline).not.toContain('needs_review');
      expect(run.timeline).not.toContain('Review API');
      expect(run.evidence).toEqual([
        `Description: Door: two-way. No new dependency.\n\nPatch:\n${patch}`,
      ]);
      expect(outcome(result).step).toMatchObject({
        verdict: 'needs-owner',
        status: 'failure',
        merge: false,
      });
    },
  );

  it('runs Triage and the Reviewer when the reviewed label was added on an earlier head', async () => {
    const run = scenario({
      markedReviewedHead: 'earlier',
      ownerProbability: 0.02,
    });
    const result = await judgeReview(run.input, run.host);
    expect(run.timeline).toContain('needs_review');
    expect(run.timeline).toContain('Review API');
    expect(outcome(result).step).toMatchObject({
      status: 'success',
      merge: true,
    });
  });

  it('distinguishes continuing review from an explicit request on a later push', async () => {
    const run = scenario({
      requested: true,
      previous: { sha: 'earlier', review: cleanReview },
    });
    const result = await judgeReview(run.input, run.host);
    expect(run.timeline).toContain('Review API');
    expect(run.timeline).not.toContain('needs_review');
    expect(run.evidence[0]).toContain(patch);
    expect(outcome(result).comment).toContain(
      'continuing review from an earlier reviewed push',
    );
  });

  it('reports reuse of the same commit’s review without starting another review', async () => {
    const run = scenario({ previous: { sha: headSha, review: cleanReview } });
    await judgeReview(run.input, run.host);
    expect(run.timeline).not.toContain('Review API');
    expect(run.timeline).toContain(
      'Reviewer: reusing the saved review for this commit',
    );
    expect(run.evidence[0]).toContain(patch);
  });

  it('requires review for a patch beyond Triage’s limit and gives Doorkeeper the full patch', async () => {
    const fullPatch = `${' '.repeat(100_000)}${patch}`;
    const run = scenario({ patch: fullPatch });
    const result = await judgeReview(run.input, run.host);
    expect(run.timeline).not.toContain('needs_review');
    expect(run.evidence[0]).toContain(fullPatch);
    expect(outcome(result).comment).toContain(
      'review required because the patch exceeds Triage’s size limit',
    );
  });

  it('stops before asking the models when the patch cannot be read', async () => {
    const run = scenario();
    await expect(
      judgeReview({ ...run.input, readPatch: () => undefined }, run.host),
    ).rejects.toThrow(
      'The patch could not be read; Doorkeeper needs it to assess owner approval',
    );
    expect(run.timeline).toEqual([]);
  });

  it('stops when Doorkeeper returns no predicate answer', async () => {
    const run = scenario({ previous: { sha: headSha, review: cleanReview } });
    await expect(
      judgeReview(run.input, { ...run.host, decide: async () => undefined }),
    ).rejects.toThrow(
      'Doorkeeper declined to judge whether owner approval is required',
    );
  });
});
