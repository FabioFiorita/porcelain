import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { judgeReview, type JudgmentHost } from './review-judgment.ts';
import { readReviewPatch } from './review-patch.ts';
import { assess, nextStep } from './review-verdict.ts';

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
  }).trim();
}

function unavailableHostedPatch(): string {
  throw new Error('HTTP 406: diff exceeds the maximum 20000 lines');
}

describe('review patch', () => {
  it('delivers a large patch from the exact Git commits when GitHub refuses the diff, including an approved retry', async () => {
    const remote = mkdtempSync(join(tmpdir(), 'porcelain-review-remote-'));
    try {
      git(remote, 'init', '-q', '-b', 'main');
      git(remote, 'config', 'user.name', 'Review fixture');
      git(remote, 'config', 'user.email', 'review@example.test');
      git(remote, 'config', 'commit.gpgsign', 'false');
      writeFileSync(join(remote, 'seed.txt'), 'seed\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Create common ancestor');
      git(remote, 'checkout', '-qb', 'feature');
      writeFileSync(
        join(remote, 'large.txt'),
        Array.from(
          { length: 20_001 },
          (_, index) => `line ${index + 1}\n`,
        ).join(''),
      );
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Add large file');
      const headSha = git(remote, 'rev-parse', 'HEAD');
      writeFileSync(join(remote, 'later.txt'), 'unreviewed later push\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Advance the feature branch');
      git(remote, 'checkout', '-q', 'main');
      writeFileSync(join(remote, 'main-only.txt'), 'unrelated main change\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Advance main');
      const baseSha = git(remote, 'rev-parse', 'HEAD');
      const patch = readReviewPatch(
        { remote, baseSha, headSha },
        unavailableHostedPatch,
      );
      const evidence: string[] = [];
      const cleanReview = { findings: [], summary: 'No actionable bugs.' };
      const host: JudgmentHost = {
        decide: async (question) => {
          evidence.push(question.evidence);
          return 0.02;
        },
        review: async () => cleanReview,
        report: () => {},
      };
      const result = await judgeReview(
        {
          evidence: 'Approved retry of a reviewed change.',
          patch,
          requested: true,
          previous: { sha: headSha, review: cleanReview },
          headSha,
        },
        host,
      );
      const current = new Set(['agent-review', 'approved']);
      const assessment = assess(
        {
          repository: 'owner/repo',
          headSha,
          body: 'Door: two-way',
          paths: ['large.txt'],
        },
        result.review,
        result.ownerApprovalProbability,
        current,
        { approved: true, trusted: true },
      );
      expect(patch).toContain('@@ -0,0 +1,20001 @@');
      expect(patch).toContain('+line 1\n');
      expect(patch).toContain('+line 20001\n');
      expect(patch).not.toContain('later.txt');
      expect(patch).not.toContain('main-only.txt');
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toContain('+line 20001\n');
      expect(nextStep(assessment, true, current).merge).toBe(true);
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  });

  it('uses a hosted patch without needing a Git remote', () => {
    expect(
      readReviewPatch(
        { remote: '/does-not-exist', baseSha: 'base', headSha: 'head' },
        () => 'diff --git a/file b/file\n+change\n',
      ),
    ).toBe('diff --git a/file b/file\n+change\n');
  });

  it('leaves the gate closed when neither GitHub nor Git can supply the patch', () => {
    expect(
      readReviewPatch(
        { remote: '/does-not-exist', baseSha: 'base', headSha: 'head' },
        unavailableHostedPatch,
      ),
    ).toBeUndefined();
  });
});
