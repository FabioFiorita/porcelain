import { seedReview } from '../kit/seed-review.ts';
import { randomUUID } from 'node:crypto';
import { access, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, vi } from 'vitest';
import { test } from '../kit/server-test.ts';
import { commitReviewFixture, sampleReview, read } from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';

test('reads GitHub PRs with per-project accounts, closes merged reviews, and never exposes tokens in responses or logs', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const statePath = join(session.projectHome, 'github-state.json');
  const listQueryPath = join(session.projectHome, 'github-list-query.txt');
  const checksQueryPath = join(session.projectHome, 'github-checks-query.txt');
  const heldPath = join(session.projectHome, 'github-accounts-held');
  const releasePath = join(session.projectHome, 'github-accounts-released');
  const probesPath = join(session.projectHome, 'github-account-probes');
  const ghPath = join(text(manifest.bin), 'gh');
  const secret = 'github-test-token-never-return-this';
  const state = {
    mode: 'ok',
    description: '# Description',
    descriptionHTML: '',
    checkState: '',
    state: 'OPEN',
    headBranch: (await session.git('branch', '--show-current')).trim(),
    accounts: ['personal', 'work'],
    readable: ['personal', 'work'],
    holdAccounts: false,
    missingPull: '',
    paginated: false,
    title: 'Fixture PR',
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
if (args[0] === 'auth' && args[1] === 'status') {
  for (let beat = 1; fixture.holdAccounts && !fs.existsSync(${JSON.stringify(releasePath)}); beat++) {
    fs.writeFileSync(${JSON.stringify(heldPath + '.pending')}, String(beat));
    fs.renameSync(${JSON.stringify(heldPath + '.pending')}, ${JSON.stringify(heldPath)});
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  console.log(JSON.stringify(fixture.accounts));
}
else if (args[0] === 'auth' && args[1] === 'token') { console.log(secret + '-' + args.at(-1)); }
else if (fixture.mode !== 'ok') { console.error((fixture.mode === 'rate' ? 'HTTP 429 rate limit exceeded ' : 'network offline ') + process.env.GH_TOKEN); process.exitCode = 1; }
else if (args.includes('number=999') || (fixture.missingPull === 'error' && args.some(arg => /PullRequest(?:Read|Checks)/.test(arg)))) { console.error('GraphQL: Could not resolve to a PullRequest with the number of 999. (repository.pullRequest)'); process.exitCode = 1; }
else if (args.includes('repos/FabioFiorita/porcelain')) {
  fs.appendFileSync(${JSON.stringify(probesPath)}, process.env.GH_TOKEN.slice(secret.length + 1) + '\\n');
  if (fixture.readable.some(account => process.env.GH_TOKEN === secret + '-' + account)) console.log('{}');
  else { console.error('HTTP 404 ' + process.env.GH_TOKEN); process.exitCode = 1; }
} else {
 if (fixture.missingPull === 'null' && args.some(arg => /PullRequest(?:Read|Checks)/.test(arg))) { console.log(JSON.stringify({ data: { repository: { pullRequest: null } } })); process.exit(0); }
 const pageInfo = { hasNextPage: false };
 const detailQuery = args.find(arg => arg.includes('PullRequestRead')) ?? '';
 const listQuery = args.find(arg => arg.includes('PullRequestList'));
 if (listQuery) fs.writeFileSync(${JSON.stringify(listQueryPath)}, listQuery);
 const checksQuery = args.find(arg => arg.includes('PullRequestChecks'));
 if (checksQuery) fs.writeFileSync(${JSON.stringify(checksQueryPath)}, checksQuery);
 const avatarUrl = detailQuery.includes('avatarUrl') ? 'https://avatars.githubusercontent.com/u/1' : undefined;
 const diffHunk = detailQuery.includes('diffHunk') ? '@@ -1 +1 @@\\n-old\\n+new' : undefined;
 const pr = { number: 423, title: fixture.title, url: 'https://github.com/FabioFiorita/porcelain/pull/423', state: fixture.state, isDraft: false,
 author: { login: 'author', avatarUrl }, createdAt: detailQuery.includes('body createdAt baseRefName') ? '2026-10-18T10:00:00Z' : undefined, headRefName: fixture.headBranch, updatedAt: '2026-10-19T12:00:00Z', commits: { nodes: fixture.checkState ? [{ commit: { statusCheckRollup: {state: fixture.checkState, contexts:{nodes:[],pageInfo} } } }] : [] }, body: fixture.description, bodyHTML: detailQuery.includes('bodyHTML') ? fixture.descriptionHTML : undefined, baseRefName: 'main', headRefOid: 'a'.repeat(40), mergeable: 'UNKNOWN', labels: { nodes: [], pageInfo },
 comments: { nodes: [{ id: 'comment', author: null, createdAt: '2026-10-19T11:00:00Z', body: 'A comment', url: 'https://github.com/comment' }], pageInfo }, reviews: { nodes: [{ id: 'review', author: { login: 'reviewer', avatarUrl }, submittedAt: '2026-10-19T12:00:00Z', body: 'A review', url: 'https://github.com/review', state: 'COMMENTED', comments: { nodes: [{ id: 'inline', author: { login: 'reviewer', avatarUrl }, createdAt: '2026-10-19T10:00:00Z', body: 'Inline comment', url: 'https://github.com/inline', path: 'README.md', line: 1, originalLine: 1, diffHunk }], pageInfo } }], pageInfo } };
 if (listQuery && !listQuery.includes('contexts')) for (const node of pr.commits.nodes) delete node.commit.statusCheckRollup.contexts;
 if (fixture.paginated && listQuery) { const next = args.includes('cursor=older-page'); console.log(JSON.stringify({ data: { repository: { open: { nodes: next ? [{ ...pr, number: 43, headRefName: 'older-topic' }] : [pr], pageInfo: { hasNextPage: !next, endCursor: next ? null : 'older-page' } }, recent: { nodes: [], pageInfo } } } })); process.exit(0); }
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
    const published = await seedReview(
      session,
      sampleReview(session, 0, randomUUID(), randomUUID()),
    );
    const reviewId = text(published.reviewId);
    const responses: unknown[] = [];
    const request = async (
      path: string,
      method: 'GET' | 'PUT' | 'POST' = 'GET',
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
    const archiveOptions = {
      deleteWorktree: true,
      deleteLocalBranch: true,
      deleteRemoteBranch: true,
    };
    await read(
      session,
      {
        method: 'POST',
        path: `/api/reviews/${reviewId}/archive`,
        body: { options: archiveOptions },
      },
      409,
    );
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
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'not-linked',
    });
    expect(await request(`${review}/pull-request/checks`)).toEqual({
      kind: 'not-linked',
    });
    const pullRequest = 'https://github.com/FabioFiorita/porcelain/pull/423';
    await read(
      session,
      {
        method: 'PUT',
        path: `${review}/pull-request`,
        auth: 'none',
        body: { pullRequest },
      },
      401,
    );

    const setPull = (value: string | null, status = 200) =>
      read(
        session,
        {
          method: 'PUT',
          path: `${review}/pull-request`,
          body: { pullRequest: value },
        },
        status,
      );
    for (const value of [
      'https://example.com/a/b/pull/1',
      '',
      'https://github.com/a/b/pull/0',
    ])
      await setPull(value, 400);
    await setPull('https://github.com/another/repository/pull/423', 409);
    const branch = state.headBranch;
    state.headBranch = 'another-branch';
    await save();
    expect(await setPull(pullRequest, 409)).toMatchObject({
      message: `The pull request head must be ${branch}.`,
    });
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'not-linked',
    });
    state.headBranch = branch;
    await save();
    expect(
      await setPull('https://github.com/FabioFiorita/porcelain/pull/999', 409),
    ).toMatchObject({
      message: 'GitHub has no pull request #999 in FabioFiorita/porcelain.',
    });
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'not-linked',
    });
    state.mode = 'rate';
    await save();
    expect(await setPull(pullRequest)).toEqual({
      kind: 'unavailable',
      reason: 'rate-limited',
    });
    expect(await request(review)).toMatchObject({
      review: { branch, latestRevision: 1 },
    });
    state.mode = 'ok';
    await save();
    state.checkState = 'SUCCESS';
    await save();
    expect(await request(`${project}/pull-requests`)).toMatchObject({
      pullRequests: [{ headBranch: branch, checksSummary: 'SUCCESS' }],
    });
    expect(await readFile(listQueryPath, 'utf8')).not.toMatch(
      /\b(body|comments|reviews|labels|contexts)\b/,
    );
    state.paginated = true;
    await save();
    expect(await request(`${project}/pull-requests`)).toMatchObject({
      pullRequests: [{ headBranch: branch }, { headBranch: 'older-topic' }],
      truncated: false,
    });
    state.paginated = false;
    await save();
    const titleViewer = await session.live();
    state.title = 'Updated fixture PR';
    await save();
    try {
      await request(`${project}/pull-requests`);
      expect(
        await titleViewer
          .next((notice) => notice.type === 'inventory', 1500)
          .catch(() => ({ type: 'missing inventory notice' })),
      ).toEqual({ type: 'inventory' });
      await request(`${project}/pull-requests`);
      expect(
        await titleViewer
          .next((notice) => notice.type === 'inventory', 200)
          .catch(() => undefined),
      ).toBeUndefined();
    } finally {
      await titleViewer.close();
    }
    state.title = 'Fixture PR';
    await save();
    const linkingViewer = await session.live();
    expect(await setPull(pullRequest)).toEqual({ kind: 'updated' });
    expect(
      await linkingViewer.next((notice) => notice.type === 'inventory'),
    ).toEqual({ type: 'inventory' });
    await linkingViewer.close();
    expect(await request(review)).toMatchObject({
      review: { pullRequest, latestRevision: 1 },
      revision: { revision: 1 },
    });
    for (const missing of ['error', 'null']) {
      state.missingPull = missing;
      await save();
      for (const path of [
        review + '/pull-request',
        review + '/pull-request/checks',
      ])
        expect(await request(path)).toEqual({
          kind: 'unavailable',
          reason: 'pull-request-not-found',
        });
      expect(await request(review)).toMatchObject({
        review: { pullRequest, state: 'open', latestRevision: 1 },
        revision: { revision: 1 },
      });
    }
    state.missingPull = '';
    await save();
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      pullRequest: { number: 423 },
    });
    for (const [checkState, checks] of [
      ['SUCCESS', 'passed'],
      ['PENDING', 'running'],
      ['FAILURE', 'failed'],
      ['', 'none'],
    ]) {
      state.checkState = checkState ?? '';
      await save();
      expect(await request(`${review}/pull-request/checks`)).toEqual({
        kind: 'available',
        number: 423,
        checks,
      });
    }
    state.checkState = 'UNRECOGNIZED';
    await save();
    expect(await request(`${review}/pull-request/checks`)).toEqual({
      kind: 'unavailable',
      reason: 'invalid-response',
    });
    state.checkState = '';
    await save();
    expect(await readFile(checksQueryPath, 'utf8')).not.toMatch(
      /\b(body|comments|reviews|labels|contexts)\b/,
    );
    state.mode = 'offline';
    await save();
    expect(await request(`${review}/pull-request/checks`)).toEqual({
      kind: 'unavailable',
      reason: 'offline',
    });
    expect(await setPull(null)).toEqual({ kind: 'updated' });
    expect(await setPull(null)).toEqual({ kind: 'updated' });
    expect(await request(`${review}/pull-request`)).toEqual({
      kind: 'not-linked',
    });
    expect(await request(review)).toMatchObject({
      review: { branch, state: 'open', latestRevision: 1 },
      revision: { revision: 1 },
    });
    state.mode = 'ok';
    await save();
    expect(await setPull(pullRequest)).toEqual({ kind: 'updated' });
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      account: 'work',
      pullRequest: {
        number: 423,
        title: 'Fixture PR',
        description: '# Description',
        matchesReviewHead: false,
        createdAt: '2026-10-18T10:00:00Z',
        authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
        timeline: [
          {
            body: 'Inline comment',
            reviewId: 'review',
            diffHunk: '@@ -1 +1 @@\n-old\n+new',
            authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
          },
          { body: 'A comment' },
          {
            body: 'A review',
            authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
          },
        ],
      },
    });
    const asset = '78eec28e-0341-411a-b9b2-7ce767b53f3f';
    const signedImage = `https://private-user-images.githubusercontent.com/1/2-${asset}.png?jwt=fixture`;
    state.description = `![Receipt](https://github.com/user-attachments/assets/${asset})`;
    state.descriptionHTML = `<img src="${signedImage}" alt="Receipt">`;
    await save();
    expect(await request(`${review}/pull-request`)).toMatchObject({
      kind: 'available',
      pullRequest: { description: `![Receipt](${signedImage})` },
    });
    expect(
      await setPull('https://github.com/FabioFiorita/porcelain/pull/999', 409),
    ).toMatchObject({
      message: 'GitHub has no pull request #999 in FabioFiorita/porcelain.',
    });
    expect(await request(review)).toMatchObject({
      review: { pullRequest },
    });
    state.holdAccounts = true;
    await save();
    const heldRead = request(`${review}/pull-request`);
    await vi.waitFor(() => access(heldPath), { timeout: 5000 });
    expect(await setPull(null)).toEqual({ kind: 'updated' });
    const heldBeat = Number(await readFile(heldPath, 'utf8'));
    await vi.waitFor(
      async () =>
        expect(Number(await readFile(heldPath, 'utf8'))).toBeGreaterThan(
          heldBeat,
        ),
      { timeout: 5000 },
    );
    await writeFile(releasePath, '');
    expect(await heldRead).toEqual({ kind: 'not-linked' });
    state.holdAccounts = false;
    await save();
    expect(await setPull(pullRequest)).toEqual({ kind: 'updated' });
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
    state.readable = ['work'];
    await save();
    await writeFile(probesPath, '');
    expect(await request(`${project}/github-account`)).toMatchObject({
      choice: { account: 'work', source: 'detected' },
    });
    expect(await request(`${project}/github-account`)).toMatchObject({
      choice: { account: 'work', source: 'detected' },
    });
    expect((await readFile(probesPath, 'utf8')).trim().split('\n')).toEqual([
      'personal',
      'work',
      'work',
    ]);
    state.readable = ['personal'];
    await save();
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
    expect(await request(`${review}/pull-request/checks`)).toEqual({
      kind: 'available',
      number: 423,
      checks: 'none',
    });
    expect(await request(review)).toMatchObject({ review: { state: 'open' } });
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
    expect(await setPull(null)).toEqual({ kind: 'updated' });
    expect(await request(review)).toMatchObject({
      review: { state: 'closed', latestRevision: 1 },
    });
    expect(await setPull(pullRequest)).toEqual({ kind: 'updated' });
    state.state = 'OPEN';
    await save();
    const reopened = await request(`${project}/pull-requests`);
    expect(reopened).toMatchObject({
      kind: 'available',
      pullRequests: [{ number: 423 }],
    });
    expect(reopened).not.toMatchObject({ pullRequests: [{ reviewId }] });
    state.state = 'MERGED';
    await save();
    const preview = await request(`${review}/archive`, 'POST', {
      options: archiveOptions,
    });
    expect(preview).toMatchObject({
      archived: false,
      plan: {
        mainCheckout: true,
      },
    });
    expect(record(preview.plan)).not.toHaveProperty('worktreePath');
    expect(record(preview.plan)).not.toHaveProperty('localBranch');
    expect(record(preview.plan)).not.toHaveProperty('remoteBranch');
    expect(
      await request(`${review}/archive`, 'POST', {
        options: archiveOptions,
        confirmation: { plan: preview.plan, discardChanges: true },
      }),
    ).toMatchObject({ archived: true });
    expect(await request(review)).toMatchObject({
      review: { state: 'closed', archived: true },
      revision: { revision: 1 },
    });
    expect((await session.git('rev-parse', '--show-toplevel')).trim()).toBe(
      session.repository,
    );
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
