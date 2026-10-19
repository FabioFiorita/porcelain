import { randomUUID } from 'node:crypto';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  commitReviewFixture,
  sampleReview,
  read,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';

test('reads GitHub PRs with per-project accounts, closes merged reviews, and never exposes tokens in responses or logs', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const statePath = join(session.projectHome, 'github-state.json');
  const ghPath = join(text(manifest.bin), 'gh');
  const secret = 'github-test-token-never-return-this';
  const state = {
    mode: 'ok',
    state: 'OPEN',
    accounts: ['personal', 'work'],
    readable: ['personal', 'work'],
  };
  const save = () => writeFile(statePath, JSON.stringify(state));
  await save();
  await writeFile(
    ghPath,
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));
const secret = ${JSON.stringify(secret)};
if (args[0] === 'auth' && args[1] === 'status') { console.log(JSON.stringify(fixture.accounts)); }
else if (args[0] === 'auth' && args[1] === 'token') { console.log(secret + '-' + args.at(-1)); }
else if (fixture.mode !== 'ok') { console.error((fixture.mode === 'rate' ? 'HTTP 429 rate limit exceeded ' : 'network offline ') + process.env.GH_TOKEN); process.exitCode = 1; }
else if (args.includes('repos/FabioFiorita/porcelain')) {
  if (fixture.readable.some(account => process.env.GH_TOKEN === secret + '-' + account)) console.log('{}');
  else { console.error('HTTP 404 ' + process.env.GH_TOKEN); process.exitCode = 1; }
} else {
 const pageInfo = { hasNextPage: false };
 const pr = { number: 423, title: 'Fixture PR', url: 'https://github.com/FabioFiorita/porcelain/pull/423', state: fixture.state, isDraft: false,
 author: { login: 'author' }, headRefName: 'feature', updatedAt: '2026-10-19T12:00:00Z', commits: { nodes: [] }, body: '# Description', baseRefName: 'main', headRefOid: 'a'.repeat(40), mergeable: 'UNKNOWN', labels: { nodes: [], pageInfo },
 comments: { nodes: [{ id: 'comment', author: null, createdAt: '2026-10-19T11:00:00Z', body: 'A comment', url: 'https://github.com/comment' }], pageInfo }, reviews: { nodes: [], pageInfo } };
 console.log(JSON.stringify({ data: { repository: args.some(arg => arg.includes('PullRequestList')) ? { open: { nodes: fixture.state === 'OPEN' ? [pr] : [], pageInfo }, recent: { nodes: fixture.state === 'OPEN' ? [] : [pr], pageInfo } } : { pullRequest: pr } } }));
}
`,
    { mode: 0o755 },
  );
  try {
    await session.git('branch', 'porcelain-fixture-base');
    await session.git(
      'remote',
      'add',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    await commitReviewFixture(session);
    const published = record(
      toolValue(
        await read(
          session,
          toolCall(session, 1, 'publish_review', {
            ...sampleReview(session, 0, randomUUID(), randomUUID()),
            pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/423',
          }),
        ),
      ),
    );
    const reviewId = text(published.reviewId);
    const responses: unknown[] = [];
    const request = async (
      path: string,
      method: 'GET' | 'PUT' = 'GET',
      body?: object,
    ) => {
      const answer = await read(session, {
        method,
        path,
        ...(body === undefined ? {} : { body }),
      });
      responses.push(answer);
      expect(JSON.stringify(answer)).not.toContain(secret);
      return record(answer);
    };
    const project = `/api/projects/${session.projectId}`;
    const review = `/api/reviews/${reviewId}`;
    expect(await request(`${project}/github-account`)).toMatchObject({
      accounts: ['personal', 'work'],
      choice: { account: 'personal', source: 'detected' },
    });
    const accountViewer = await session.live();
    expect(
      await request(`${project}/github-account`, 'PUT', { account: 'work' }),
    ).toMatchObject({
      choice: { account: 'work', source: 'overridden' },
      override: 'work',
    });
    expect(
      await accountViewer.next((notice) => notice.type === 'inventory'),
    ).toEqual({ type: 'inventory' });
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      account: 'work',
      pullRequest: {
        number: 423,
        title: 'Fixture PR',
        description: '# Description',
        matchesReviewHead: false,
        timeline: [{ body: 'A comment' }],
      },
    });
    expect(await request(`${project}/pull-requests`)).toMatchObject({
      kind: 'available',
      pullRequests: [{ number: 423, reviewId }],
    });
    state.readable = ['personal'];
    await save();
    expect(await request(`${project}/github-account`)).toMatchObject({
      override: 'work',
      unavailable: { reason: 'no-access' },
    });
    expect(
      await request(`${project}/github-account`, 'PUT', { account: null }),
    ).toMatchObject({ choice: { account: 'personal', source: 'detected' } });
    expect(
      await accountViewer.next((notice) => notice.type === 'inventory'),
    ).toEqual({ type: 'inventory' });
    await accountViewer.close();
    state.mode = 'rate';
    await save();
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'unavailable',
      reason: 'rate-limited',
    });
    expect(await request(review)).toMatchObject({
      review: { state: 'open' },
      revision: { revision: 1 },
    });
    state.mode = 'offline';
    await save();
    expect(await request(`${project}/pull-requests`)).toEqual({
      kind: 'unavailable',
      reason: 'offline',
    });
    state.mode = 'ok';
    state.accounts = [];
    await save();
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'unavailable',
      reason: 'no-accounts',
    });
    state.accounts = ['personal'];
    state.state = 'MERGED';
    await save();
    const viewer = await session.live();
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      pullRequest: { state: 'merged' },
    });
    expect(await viewer.next((notice) => notice.type === 'inventory')).toEqual({
      type: 'inventory',
    });
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      pullRequest: { state: 'merged' },
    });
    await expect(
      viewer.next((notice) => notice.type === 'inventory', 150),
    ).rejects.toThrow('Timed out');
    await viewer.close();
    expect(await request(review)).toMatchObject({
      review: { state: 'closed' },
      revision: { revision: 1 },
    });
    await session.git(
      'remote',
      'set-url',
      'origin',
      'https://gitlab.com/a/b.git',
    );
    expect(await request(`${project}/github-account`)).toMatchObject({
      unavailable: { reason: 'not-github' },
    });
    await rm(ghPath);
    await session.git(
      'remote',
      'set-url',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    expect(await request(`${project}/github-account`)).toMatchObject({
      unavailable: { reason: 'gh-not-installed' },
    });
    expect(JSON.stringify(responses)).not.toContain(secret);
    expect(JSON.stringify(server.logs())).not.toContain(secret);
  } finally {
    await rm(ghPath, { force: true });
  }
});
