import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vite-plus/test';
import { apiError } from '../kit/answers.ts';
import { read } from '../kit/requests.ts';
import { handlerCoverage } from '../kit/route-coverage.ts';
import { test } from '../kit/server-test.ts';
import { record, text } from '../kit/session.ts';

const HEAD = 'a'.repeat(40);
const OTHER = 'c'.repeat(40);
const JOB_LOG = [
  '2026-11-25T10:00:30Z ##[group]Set up job',
  '2026-11-25T10:00:31Z Preparing',
  '2026-11-25T10:01:10Z ##[group]Run tests',
  '2026-11-25T10:02:00Z 1 test failed',
  '2026-11-25T10:02:01Z ##[error]Process completed with exit code 1.',
  '',
].join('\n');

test('shows a pull request’s checks and a failed job’s log, and re-runs, comments and merges only against the head the developer saw', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const ghPath = join(text(manifest.bin), 'gh');
  const statePath = join(session.projectHome, 'actions-gh-state.json');
  const writesPath = join(session.projectHome, 'actions-gh-writes');
  const state = { blocked: false };
  const save = () => writeFile(statePath, JSON.stringify(state));
  await save();
  await writeFile(writesPath, '');
  await writeFile(
    ghPath,
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));
const endpoint = args.find(arg => arg.startsWith('repos/')) ?? '';
const stdin = () => { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } };
const write = (input) => fs.appendFileSync(${JSON.stringify(writesPath)}, JSON.stringify({ endpoint, input }) + '\\n');
const refuse = (line) => { console.error(line); process.exit(1); };
const job = { __typename: 'CheckRun', databaseId: 61004, name: 'Browser tests', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://github.com/fixture/project/actions/runs/9001/job/61004', startedAt: '2026-11-25T10:00:00Z', completedAt: '2026-11-25T10:03:00Z', isRequired: true, title: null, summary: null, checkSuite: { app: { name: 'GitHub Actions', slug: 'github-actions' }, workflowRun: { databaseId: 9001, workflow: { name: 'CI' } } }, steps: { nodes: [{ number: 1, name: 'Run tests', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2026-11-25T10:01:00Z', completedAt: '2026-11-25T10:03:00Z' }] }, annotations: { nodes: [] } };
const status = { number: 7, state: 'OPEN', isDraft: false, headRefOid: ${JSON.stringify(HEAD)}, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED', reviewDecision: 'APPROVED', reviewRequests: { nodes: [{ requestedReviewer: { login: 'octo' } }] }, commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE', contexts: { nodes: [job], pageInfo: { hasNextPage: false } } } } }] } };
if (args[0] === 'auth' && args[1] === 'status') console.log(JSON.stringify(['fixture']));
else if (args[0] === 'auth' && args[1] === 'token') console.log('fixture-token');
else if (args.includes('graphql') && args.some(arg => arg.includes('PullRequestStatus'))) console.log(JSON.stringify({ data: { repository: { viewerPermission: 'WRITE', pullRequest: status } } }));
else if (endpoint.endsWith('/actions/jobs/61004/logs')) process.stdout.write(${JSON.stringify(JOB_LOG)});
else if (endpoint.includes('/actions/jobs/') && endpoint.endsWith('/logs')) refuse('gh: Not Found (HTTP 404)');
else if (endpoint.endsWith('/actions/jobs/61004/rerun')) write(stdin());
else if (endpoint.endsWith('/issues/7/comments')) { write(JSON.parse(stdin())); console.log(JSON.stringify({ html_url: 'https://github.com/fixture/project/pull/7#issuecomment-1' })); }
else if (endpoint.endsWith('/pulls/7/merge')) {
  const input = JSON.parse(stdin());
  if (input.sha !== ${JSON.stringify(HEAD)}) refuse('gh: Head branch was modified. Review and try the merge again. (HTTP 409)');
  if (fixture.blocked) refuse('gh: Required status check "Browser tests" is failing. (HTTP 405)');
  write(input);
  console.log(JSON.stringify({ merged: true, sha: 'b'.repeat(40) }));
} else console.log('{}');
`,
    { mode: 0o755 },
  );
  try {
    await session.git(
      'remote',
      'add',
      'origin',
      'https://github.com/fixture/project.git',
    );
    const pull = `/api/projects/${session.projectId}/pull-requests/7`;
    const writes = async () =>
      (await readFile(writesPath, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line): unknown => JSON.parse(line));
    const refusal = async (path: string, body: object, message: string) => {
      const answer = await session.send({ method: 'POST', path, body });
      expect(answer.status, message).toBe(409);
      expect(answer.body).toEqual(apiError(409, 'Conflict', message));
    };

    expect(
      await read(session, { method: 'GET', path: `${pull}/status` }),
    ).toMatchObject({
      kind: 'available',
      status: {
        number: 7,
        state: 'open',
        headSha: HEAD,
        requestedReviewers: ['octo'],
        checks: [{ name: 'Browser tests', jobId: 61004, runId: 9001 }],
      },
    });

    const log = record(
      await read(session, {
        method: 'GET',
        path: `${pull}/jobs/61004/log?from=2026-11-25T10:01:00Z&to=2026-11-25T10:03:00Z`,
      }),
    );
    expect(log).toEqual({
      kind: 'available',
      excerpt: {
        source: 'step',
        lines: [
          { text: 'Run tests', level: 'group' },
          { text: '1 test failed', level: 'plain' },
          { text: 'Process completed with exit code 1.', level: 'error' },
        ],
        omitted: 0,
      },
    });
    expect(
      await read(session, { method: 'GET', path: `${pull}/jobs/999/log` }),
    ).toEqual({ kind: 'unavailable', reason: 'log-missing' });

    await refusal(
      `${pull}/rerun`,
      { headSha: OTHER, target: { kind: 'job', jobId: 61004 } },
      'The pull request has a newer head. Read it again before re-running.',
    );
    await refusal(
      `${pull}/rerun`,
      { headSha: HEAD, target: { kind: 'job', jobId: 5 } },
      'This check is no longer on the pull request’s head.',
    );
    expect(await writes()).toEqual([]);
    expect(
      await read(session, {
        method: 'POST',
        path: `${pull}/rerun`,
        body: { headSha: HEAD, target: { kind: 'job', jobId: 61004 } },
      }),
    ).toEqual({ requested: true });

    expect(
      await read(session, {
        method: 'POST',
        path: `${pull}/comments`,
        body: { body: 'Looks good once the browser tests pass.' },
      }),
    ).toEqual({
      url: 'https://github.com/fixture/project/pull/7#issuecomment-1',
    });

    await refusal(
      `${pull}/merge`,
      { method: 'squash', headSha: OTHER },
      'The pull request changed since it was read. Read it again before merging.',
    );
    state.blocked = true;
    await save();
    await refusal(
      `${pull}/merge`,
      { method: 'squash', headSha: HEAD },
      'GitHub refused the merge: Required status check "Browser tests" is failing.',
    );
    state.blocked = false;
    await save();
    expect(
      await read(session, {
        method: 'POST',
        path: `${pull}/merge`,
        body: { method: 'squash', headSha: HEAD },
      }),
    ).toEqual({ merged: true });

    expect(await writes()).toEqual([
      {
        endpoint: 'repos/fixture/project/actions/jobs/61004/rerun',
        input: '',
      },
      {
        endpoint: 'repos/fixture/project/issues/7/comments',
        input: { body: 'Looks good once the browser tests pass.' },
      },
      {
        endpoint: 'repos/fixture/project/pulls/7/merge',
        input: { merge_method: 'squash', sha: HEAD },
      },
    ]);

    const registered = server.routes.filter((route) =>
      /\/pull-requests\/:number\/(?:status|jobs|rerun|comments|merge)/.test(
        route,
      ),
    );
    expect(registered).toHaveLength(5);
    const requested = await server.requestedRoutes();
    expect(() => handlerCoverage([{ registered, requested }])).not.toThrow();
  } finally {
    await rm(ghPath, { force: true });
  }
});
