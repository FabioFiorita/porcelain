import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vite-plus/test';
import { explanationComment, failureExcerpt } from './failure-explanation.ts';
import { dollars, summaryModel } from './openai.ts';

it.each([
  { input: 2_000, cached: 400, written: 200, cost: 0.00217 },
  { input: 273_000, cached: 0, written: 0, cost: 0.54675 },
])('estimates the response cost for $input input tokens', (usage) => {
  expect(
    dollars(summaryModel, {
      input: usage.input,
      cached: usage.cached,
      written: usage.written,
      output: 100,
    }),
  ).toBeCloseTo(usage.cost, 9);
});

it('reports the known total when another cost is unavailable', () => {
  const module = new URL('./openai.ts', import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
    import { jobCosts } from ${JSON.stringify(module.href)};
    const costs = jobCosts();
    costs.record('Decision', 0.0012);
    costs.record('Reviewer', undefined);
    costs.summarize('### Fixture costs');
    `,
    ],
    { encoding: 'utf8', env: {}, timeout: 4_000 },
  );
  if (result.error) throw result.error;
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(
    '### Fixture costs\n- Decision: $0.001200 USD\n- Reviewer: unavailable\n- Estimated total: $0.001200 USD (some costs unknown)',
  );
});

describe('failureExcerpt', () => {
  it('keeps an early assertion from a long log along with its end, without timestamps or colors', () => {
    const log = [
      '\uFEFF2026-11-05T21:15:37.6390022Z \u001b[31m FAIL  spec/integration/read-more.test.tsx > keeps its diffs\u001b[39m',
      '2026-11-05T21:15:37.6546997Z AssertionError: expected 499 to be 583',
      ...Array.from(
        { length: 500 },
        (_, index) => `2026-11-05T21:15:38.0000000Z progress ${index}`,
      ),
      '2026-11-05T21:15:39.0000000Z ##[error]Process completed with exit code 1.',
    ].join('\n');
    const excerpt = failureExcerpt(log);
    expect(excerpt.split('\n').slice(0, 2)).toEqual([
      ' FAIL  spec/integration/read-more.test.tsx > keeps its diffs',
      'AssertionError: expected 499 to be 583',
    ]);
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
        omittedJobs: 0,
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
