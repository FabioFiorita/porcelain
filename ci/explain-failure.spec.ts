import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

const head = 'a'.repeat(40);
const otherHead = 'b'.repeat(40);

function runFailureExplanation(
  options: {
    owner?: string;
    branch?: string;
    base?: string;
    numbers?: number[];
    association?: string;
    state?: string;
    draft?: boolean;
    currentHead?: string;
    currentBranch?: string;
    currentOwner?: string;
    currentBase?: string;
    changedHead?: boolean;
    retarget?: 'before-request' | 'after-request';
    existing?: string;
    noKey?: boolean;
    missingLog?: number;
    jobsError?: boolean;
    response?: 'error' | 'malformed' | 'incomplete';
    retryStatus?: 429 | 503;
    retryExhausted?: boolean;
    releaseNotes?: boolean;
  } = {},
) {
  const directory = mkdtempSync(join(temporaryRoot, 'porcelain-failure-'));
  const events = join(directory, 'events');
  const summary = join(directory, 'summary');
  const requests = join(directory, 'requests');
  const comment = join(directory, 'comment');
  try {
    for (const file of [events, summary, requests, comment])
      writeFileSync(file, '');
    writeFileSync(
      join(directory, 'gh'),
      `#!${process.execPath}
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');
const options = JSON.parse(process.env.FIXTURE_OPTIONS);
const head = process.env.HEAD_SHA;
const args = process.argv.slice(2);
const endpoint = args.at(-1);
const reply = (value) => console.log(JSON.stringify(value));
const record = (event) => appendFileSync(process.env.FIXTURE_EVENTS, event + '\\n');
const pull = {
  number: 42, author_association: options.association ?? 'COLLABORATOR',
  state: options.state ?? 'open', draft: options.draft ?? false,
  head: {
    sha: options.currentHead ?? head, ref: options.currentBranch ?? options.branch ?? 'feature',
    repo: { owner: { login: options.currentOwner ?? 'owner' } },
  },
  base: { ref: options.currentBase ?? options.base ?? 'main' },
};
const job = (id, name, conclusion = 'failure') => ({
  id, name, conclusion, html_url: 'https://github.com/owner/repo/actions/runs/1/job/' + id,
  steps: [{ name: 'Run specs', conclusion }],
});
if (endpoint === 'repos/owner/repo/pulls?state=open&head=' + encodeURIComponent('owner:' + (options.branch ?? 'feature'))) {
  record('branch lookup');
  reply([[{ number: 42, head: { sha: head }, base: { ref: options.base ?? 'main' } }]]);
} else if (endpoint === 'repos/owner/repo/pulls?state=open&head=fork%3Amain') {
  record('fork branch lookup');
  reply([[{ number: 43, head: { sha: head }, base: { ref: 'release' } }]]);
} else if (endpoint === 'repos/owner/repo/commits/' + head + '/pulls') {
  reply([{ number: 42 }]);
} else if (endpoint === 'repos/owner/repo/pulls/42' || endpoint === 'repos/owner/repo/pulls/43') {
  const requested = readFileSync(process.env.FIXTURE_REQUESTS, 'utf8').length > 0;
  const logsFetched = readFileSync(process.env.FIXTURE_EVENTS, 'utf8').includes('3\\n');
  if (options.changedHead && requested) pull.head.sha = 'b'.repeat(40);
  if ((options.retarget === 'before-request' && logsFetched) || (options.retarget === 'after-request' && requested))
    pull.base.ref = 'release';
  reply(pull);
} else if (args[0] === 'pr' && args[1] === 'view') {
  reply({
    number: 42, title: 'Change a feature', body: 'Improves a feature.',
    state: pull.state.toUpperCase(), isDraft: pull.draft, headRefOid: pull.head.sha,
  });
} else if (endpoint === 'repos/owner/repo/issues/42/comments' || endpoint === 'repos/owner/repo/issues/43/comments') {
  const prior = options.existing;
  reply([prior ? [{ id: 1, user: { type: 'Bot' }, body: prior }] : []]);
} else if (args.includes('repos/owner/repo/issues/42/comments') || args.includes('repos/owner/repo/issues/43/comments') || args.includes('repos/owner/repo/issues/comments/1')) {
  writeFileSync(process.env.FIXTURE_COMMENT, JSON.parse(readFileSync(0, 'utf8')).body);
  reply({});
} else if (endpoint === 'repos/owner/repo/actions/runs/1/jobs') {
  if (options.jobsError) {
    console.error('fixture gh stderr: job list rejected');
    process.exit(1);
  }
  reply([{ jobs: [
    job(1, 'checks'), job(2, 'release checks'), job(3, 'static'),
    job(4, 'units', 'timed_out'), job(5, 'web (1)'), job(6, 'web (2)'),
    job(7, 'web (3)'), job(8, 'package', 'success'),
  ] }]);
} else if (args.includes('repos/owner/repo/releases/generate-notes')) {
  reply({ body: '* Improve a feature by @owner in https://github.com/owner/repo/pull/42' });
} else if (args[0] === 'release' && args[1] === 'edit') {
  record('release notes written');
  reply({});
} else {
  throw new Error('Unexpected GitHub request: ' + JSON.stringify(args));
}
`,
      { mode: 0o700 },
    );
    const fetchFixture = `
import { appendFileSync, readFileSync } from 'node:fs';
const options = JSON.parse(process.env.FIXTURE_OPTIONS);
globalThis.fetch = async (request, init) => {
  const url = new URL(request instanceof Request ? request.url : request);
  if (url.hostname === 'api.github.com') {
    const job = url.pathname.split('/').at(-2);
    appendFileSync(process.env.FIXTURE_EVENTS, job + '\\n');
    if (Number(job) === options.missingLog) return new Response('Not found', { status: 404 });
    return new Response('FAIL: assertion before readiness');
  }
  if (url.hostname !== 'api.openai.com' || url.pathname !== '/v1/responses')
    throw new Error('Unexpected API request: ' + url);
  const retry = readFileSync(process.env.FIXTURE_REQUESTS, 'utf8').length > 0;
  appendFileSync(process.env.FIXTURE_REQUESTS, init.body + '\\n');
  if (options.response === 'error')
    return Response.json({ error: { message: 'fixture API error' } }, { status: 400 });
  if (options.retryStatus && (!retry || options.retryExhausted))
    return Response.json({ error: { message: 'fixture transient error' } }, {
      status: options.retryStatus, headers: { 'retry-after-ms': '1' },
    });
  return Response.json({
    object: 'response',
    status: options.response === 'incomplete' ? 'incomplete' : 'completed',
    incomplete_details: options.response === 'incomplete' ? { reason: 'max_output_tokens' } : null,
    output: [{ type: 'message', content: [{
      type: 'output_text',
      text: options.response === 'malformed' ? '{}' : JSON.stringify(
        options.releaseNotes ? { highlight: 'A change.', sections: [] } :
          { summary: 'An assertion failed.', jobs: [] },
      ),
    }] }],
    usage: {
      input_tokens: 2000, output_tokens: 100, total_tokens: 2100,
      input_tokens_details: { cached_tokens: 400, cache_write_tokens: 200 },
      output_tokens_details: { reasoning_tokens: 25 },
    },
  });
};`;
    const script = new URL(
      options.releaseNotes ? './release-notes.ts' : './explain-failure.ts',
      import.meta.url,
    );
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        `data:text/javascript,${encodeURIComponent(fetchFixture)}`,
        fileURLToPath(script),
      ],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: {
          PATH: directory,
          FIXTURE_OPTIONS: JSON.stringify(options),
          FIXTURE_EVENTS: events,
          FIXTURE_REQUESTS: requests,
          FIXTURE_COMMENT: comment,
          GITHUB_REPOSITORY: 'owner/repo',
          GITHUB_STEP_SUMMARY: summary,
          GH_TOKEN: 'fixture-gh-token',
          OPENAI_API_KEY: options.noKey ? '' : 'fixture-api-key',
          RUN_ID: '1',
          RUN_URL: 'https://github.com/owner/repo/actions/runs/1',
          HEAD_SHA: head,
          HEAD_OWNER: options.owner ?? 'owner',
          HEAD_BRANCH: options.branch ?? 'feature',
          PULL_REQUESTS: JSON.stringify(options.numbers ?? []),
          TAG: 'v0.85.0',
        },
      },
    );
    if (result.error) throw result.error;
    const paidRequests = readFileSync(requests, 'utf8').trim();
    return {
      status: result.status,
      error: result.stderr,
      requests: paidRequests
        ? paidRequests.split('\n').map((line): unknown => JSON.parse(line))
        : [],
      events: readFileSync(events, 'utf8').trim().split('\n').filter(Boolean),
      summary: readFileSync(summary, 'utf8'),
      comment: readFileSync(comment, 'utf8'),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('failed workflow PR identity and eligibility', () => {
  it('rejects a fork promotion sharing the trusted PR commit', () => {
    const result = runFailureExplanation({ owner: 'fork', branch: 'main' });
    expect(result.status, result.error).toBe(0);
    expect(result.events).toEqual(['fork branch lookup']);
    expect(result.requests).toEqual([]);
    expect(result.comment).toBe('');
  });

  it('rejects a payload PR number outside the run’s owner and branch', () => {
    const result = runFailureExplanation({ numbers: [43] });
    expect(result.status, result.error).toBe(0);
    expect(result.events).toEqual(['branch lookup']);
    expect(result.requests).toEqual([]);
  });

  it('resolves a repository main-to-release promotion', () => {
    const result = runFailureExplanation({ branch: 'main', base: 'release' });
    expect(result.status, result.error).toBe(0);
    expect(result.requests).toHaveLength(1);
    expect(result.comment).toContain('An assertion failed.');
  });

  it.each([
    { condition: 'untrusted author', association: 'CONTRIBUTOR' },
    { condition: 'closed PR', state: 'closed' },
    { condition: 'draft PR', draft: true },
    { condition: 'stale head', currentHead: otherHead },
    { condition: 'different head ref', currentBranch: 'another-branch' },
    { condition: 'different head repository owner', currentOwner: 'fork' },
    { condition: 'different base ref', currentBase: 'release' },
  ])('does not fetch logs or call the model for a $condition', (options) => {
    const result = runFailureExplanation({ numbers: [42], ...options });
    expect(result.status, result.error).toBe(0);
    expect(result.requests).toEqual([]);
    expect(result.events).toEqual(['branch lookup']);
    expect(result.comment).toBe('');
  });

  it('does not publish an explanation after a new head is pushed', () => {
    const result = runFailureExplanation({ changedHead: true });
    expect(result.status, result.error).toBe(0);
    expect(result.requests).toHaveLength(1);
    expect(result.comment).toBe('');
  });

  it.each([
    { retarget: 'before-request' as const, requests: 0 },
    { retarget: 'after-request' as const, requests: 1 },
  ])(
    'binds the explanation to the original base when retargeted $retarget',
    ({ retarget, requests }) => {
      const result = runFailureExplanation({ retarget });
      expect(result.status, result.error).toBe(0);
      expect(result.requests).toHaveLength(requests);
      expect(result.comment).toBe('');
    },
  );
});

describe('failed workflow cost and reporting', () => {
  it('limits the call to four failed jobs, omits aggregators and caps output', () => {
    const result = runFailureExplanation();
    expect(result.status, result.error).toBe(0);
    expect(result.events).toEqual(['branch lookup', '3', '4', '5', '6']);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toHaveProperty('max_output_tokens', 4000);
    expect(result.requests[0]).toHaveProperty('reasoning', { effort: 'none' });
    expect(JSON.stringify(result.requests[0])).toContain('Job: web (2)');
    expect(result.comment).toContain('An assertion failed.');
    expect(result.summary).toContain('$0.002170 USD');
  });

  it('explains the remaining jobs when one log is missing', () => {
    const result = runFailureExplanation({ missingLog: 3 });
    expect(result.status, result.error).toBe(0);
    expect(result.requests).toHaveLength(1);
    const input = JSON.stringify(result.requests[0]);
    expect(input).toContain('GitHub answered 404');
    expect(input).toContain('FAIL: assertion before readiness');
    expect(result.comment).toContain('An assertion failed.');
  });

  it('spends nothing on another run of a head that already has an explanation', () => {
    const first = runFailureExplanation();
    expect(first.status, first.error).toBe(0);
    expect(first.comment).toContain('An assertion failed.');
    const rerun = runFailureExplanation({ existing: first.comment });
    expect(rerun.status, rerun.error).toBe(0);
    expect(rerun.events).toEqual(['branch lookup']);
    expect(rerun.requests).toEqual([]);
    expect(rerun.comment).toBe('');
    expect(rerun.summary).toContain('already has an explanation attempt');
  });

  it('reports a missing key before fetching logs', () => {
    const result = runFailureExplanation({ noKey: true });
    expect(result.status).toBe(1);
    expect(result.events).toEqual(['branch lookup']);
    expect(result.requests).toEqual([]);
    expect(result.summary).toContain('OPENAI_API_KEY');
  });

  it('logs the API status and message and keeps the job summary short', () => {
    const result = runFailureExplanation({ response: 'error' });
    expect(result.status).toBe(1);
    expect(result.requests).toHaveLength(1);
    expect(result.comment).toBe('');
    expect(result.summary).toContain('Responses API call failed');
    expect(result.summary).toContain('some costs unknown');
    expect(result.summary).not.toContain('fixture API error');
    expect(result.error).toMatch(/OpenAI HTTP 400:.*fixture API error/);
  });

  it('logs gh stderr and keeps the job summary short', () => {
    const result = runFailureExplanation({ jobsError: true });
    expect(result.status).toBe(1);
    expect(result.requests).toEqual([]);
    expect(result.summary).toContain('Could not read the failed jobs');
    expect(result.summary).not.toContain('job list rejected');
    expect(result.error).toContain('fixture gh stderr: job list rejected');
  });

  it.each([
    { response: 'malformed' as const, detail: '["summary"]' },
    { response: 'incomplete' as const, detail: 'max_output_tokens' },
  ])(
    'records a $response response and skips a later attempt on the same head',
    ({ response, detail }) => {
      const result = runFailureExplanation({ response });
      expect(result.status).toBe(1);
      expect(result.requests).toHaveLength(1);
      expect(result.summary).toContain('invalid structured response');
      expect(result.summary).toContain('$0.002170 USD');
      expect(result.error).toContain(detail);
      expect(result.comment).toContain('Could not generate an explanation');
      expect(result.comment).toContain(
        'https://github.com/owner/repo/actions/runs/1',
      );
      const rerun = runFailureExplanation({ existing: result.comment });
      expect(rerun.status, rerun.error).toBe(0);
      expect(rerun.requests).toEqual([]);
      expect(rerun.events).toEqual(['branch lookup']);
      expect(rerun.summary).toContain('already has an explanation attempt');
    },
  );

  it.each([429, 503] as const)(
    'retries HTTP %i once and uses the response',
    (retryStatus) => {
      const result = runFailureExplanation({ retryStatus });
      expect(result.status, result.error).toBe(0);
      expect(result.requests).toHaveLength(2);
      expect(result.comment).toContain('An assertion failed.');
    },
  );

  it('stops after the one retry when a 503 persists', () => {
    const result = runFailureExplanation({
      retryStatus: 503,
      retryExhausted: true,
    });
    expect(result.status).toBe(1);
    expect(result.requests).toHaveLength(2);
    expect(result.summary).toContain('Responses API call failed');
    expect(result.error).toMatch(/OpenAI HTTP 503:.*fixture transient error/);
  });

  it('reports the release notes model’s cost from the same usage', () => {
    const result = runFailureExplanation({ releaseNotes: true });
    expect(result.status, result.error).toBe(0);
    expect(result.events).toEqual(['release notes written']);
    expect(result.summary).toContain('$0.002170 USD');
  });
});
