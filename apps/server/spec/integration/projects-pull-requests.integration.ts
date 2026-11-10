import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { read } from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';

test('reads GitHub PRs by project and number with per-project accounts, bounded payloads and secret-free failures', async ({
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
    await session.git(
      'remote',
      'add',
      'origin',
      'git@github.com:FabioFiorita/porcelain.git',
    );
    const project = `/api/projects/${session.projectId}`;
    const pull = `${project}/pull-requests/423`;
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
    expect(await request(`${project}/github-account`)).toMatchObject({
      accounts: ['personal', 'work'],
      choice: { account: 'personal', source: 'detected' },
    });
    expect(
      await request(`${project}/github-account`, 'PUT', { account: 'work' }),
    ).toMatchObject({
      override: 'work',
      choice: { account: 'work', source: 'overridden' },
    });
    expect(await request(pull)).toMatchObject({
      kind: 'available',
      account: 'work',
      pullRequest: {
        number: 423,
        title: 'Fixture PR',
        description: '# Description',
        timeline: [
          {
            body: 'Inline comment',
            reviewId: 'review',
            diffHunk: '@@ -1 +1 @@\n-old\n+new',
          },
          { body: 'A comment' },
          { body: 'A review' },
        ],
      },
    });
    expect(await request(`${project}/pull-requests`)).toMatchObject({
      kind: 'available',
      pullRequests: [{ number: 423, headBranch: state.headBranch }],
    });
    expect(await readFile(listQueryPath, 'utf8')).not.toContain('contexts');
    state.checkState = 'FAILURE';
    await save();
    expect(await request(`${pull}/checks`)).toEqual({
      kind: 'available',
      number: 423,
      checks: 'failed',
    });
    expect(await readFile(checksQueryPath, 'utf8')).not.toContain('bodyHTML');
    state.paginated = true;
    await save();
    expect(await request(`${project}/pull-requests`)).toMatchObject({
      kind: 'available',
      pullRequests: [{ number: 423 }, { number: 43 }],
      truncated: false,
    });
    state.paginated = false;
    state.readable = ['personal'];
    await save();
    expect(await request(`${project}/github-account`)).toMatchObject({
      override: 'work',
      unavailable: { reason: 'no-access' },
    });
    expect(await request(pull)).toEqual({
      kind: 'unavailable',
      reason: 'no-access',
    });
    expect(
      await request(`${project}/github-account`, 'PUT', { account: null }),
    ).toMatchObject({ choice: { account: 'personal', source: 'detected' } });
    for (const [mode, reason] of [
      ['rate', 'rate-limited'],
      ['offline', 'offline'],
    ] as const) {
      state.mode = mode;
      await save();
      expect(await request(pull)).toEqual({ kind: 'unavailable', reason });
      expect(await request(`${pull}/checks`)).toEqual({
        kind: 'unavailable',
        reason,
      });
    }
    state.mode = 'ok';
    state.missingPull = 'null';
    await save();
    expect(await request(pull)).toEqual({
      kind: 'unavailable',
      reason: 'pull-request-not-found',
    });
    state.missingPull = '';
    state.state = 'MERGED';
    await save();
    expect(await request(pull)).toMatchObject({
      kind: 'available',
      pullRequest: { state: 'merged' },
    });
    expect(
      await request(`${pull}/archive`, 'POST', {
        options: {
          deleteWorktree: false,
          deleteLocalBranch: false,
          deleteRemoteBranch: false,
        },
      }),
    ).toMatchObject({ archived: false, plan: { mainCheckout: true } });
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
