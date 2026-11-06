import { describe, expect, it } from 'vitest';
import { explanationComment, failureExcerpt } from './failure-explanation.ts';

describe('failureExcerpt', () => {
  it('keeps an early assertion from a long log along with its end, without timestamps or colors', () => {
    const log = [
      '2026-11-05T21:15:37.6546997Z \u001b[31m##[error]AssertionError: expected 499 to be 583\u001b[39m',
      ...Array.from(
        { length: 500 },
        (_, index) => `2026-11-05T21:15:38.0000000Z progress ${index}`,
      ),
      '2026-11-05T21:15:39.0000000Z ##[error]Process completed with exit code 1.',
    ].join('\n');
    const excerpt = failureExcerpt(log);
    expect(excerpt.split('\n')[0]).toBe(
      '##[error]AssertionError: expected 499 to be 583',
    );
    expect(excerpt).not.toContain('progress 100\n');
    expect(
      excerpt.endsWith('##[error]Process completed with exit code 1.'),
    ).toBe(true);
  });
});

describe('explanationComment', () => {
  it('links each failed job to its log and marks a likely flaky one', () => {
    const comment = explanationComment(
      {
        url: 'https://github.com/owner/repo/actions/runs/1',
        headSha: 'cce70c472bb6a4c66beac1b4582d6c9cd7de7051',
        jobs: [
          {
            name: 'web-integration (4)',
            url: 'https://github.com/owner/repo/actions/runs/1/job/2',
            steps: ['Run tests'],
            excerpt: '',
          },
        ],
      },
      {
        summary: 'One browser test timed out.',
        jobs: [
          {
            job: 'web-integration (4)',
            failing: 'changes-branch-read-more.test.tsx',
            cause: 'The page did not load before the deadline.',
            likely_flaky: true,
            next_step: 'Rerun the job.',
            log_line: 'TimeoutError: waiting for `content`',
          },
        ],
      },
      'gpt-6.1-terra',
    );
    expect(comment).toContain(
      '- **[web-integration (4)](https://github.com/owner/repo/actions/runs/1/job/2)** (likely flaky): changes-branch-read-more.test.tsx',
    );
    expect(comment).toContain("`TimeoutError: waiting for 'content'`");
  });
});
