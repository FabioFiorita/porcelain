import { randomUUID } from 'node:crypto';
import { readGitStatusResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import {
  changes,
  expectation,
  fingerprintOf,
  head,
  settledReceipt,
} from '../kit/reads.ts';
import { gitPath, lineCount, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function status(session: Session): HttpRequest {
  return { method: 'GET', path: worktreePath(session, '/git/status') };
}

test('the git status of the sample unstaged change reports its entry, the head commit and the branch, with the status token of the changes read', async ({
  session,
}) => {
  const headOid = await head(session);
  const seen = await changes(session);

  const response = await session.send(status(session));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readGitStatusResponseSchema),
  );
  expect(response.body).toMatchObject({
    worktreeId: session.worktreeId,
    statusToken: seen.statusToken,
    branch: {
      name: session.fixture.branch,
      upstream: null,
      ahead: 0,
      behind: 0,
      remoteName: null,
      sourceRef: null,
      upstreamOid: null,
      stashes: [],
      discarded: [],
    },
    consistency: 'best-effort',
    headOid,
    inProgress: null,
    mergeHeadOid: null,
    headCommit: { subject: session.fixture.initialCommit },
    changes: [
      {
        scope: 'unstaged',
        kind: 'modified',
        oldPath: session.fixture.readme.path,
        newPath: session.fixture.readme.path,
      },
    ],
  });
});

test('the git status of a branch one commit ahead of its upstream names the upstream, the remote and the upstream commit', async ({
  session,
}) => {
  const remote = `${session.projectHome}/remote.git`;
  const branch = session.fixture.branch;
  await session.git('init', '--bare', '-b', branch, remote);
  await session.git('remote', 'add', 'origin', remote);
  await session.git('push', '--set-upstream', 'origin', branch);
  const upstream = await head(session);
  await session.git('commit', '--allow-empty', '-m', 'Local only');

  const response = await session.send(status(session));

  expect(response.status).toBe(200);
  expect(record(response.body).branch).toMatchObject({
    name: session.fixture.branch,
    upstream: `origin/${session.fixture.branch}`,
    ahead: 1,
    behind: 0,
    remoteName: 'origin',
    sourceRef: `refs/heads/${session.fixture.branch}`,
    upstreamOid: upstream,
  });
});

test('the git status lists a discarded hunk so it can be restored', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  const requestId = randomUUID();
  await session.read(
    {
      method: 'POST',
      path: gitPath(session, '/actions'),
      body: {
        requestId,
        input: {
          action: 'discard',
          path,
          hunk: {
            scope: 'unstaged',
            startLine: lineCount(session.fixture.readme.committed) + 1,
            endLine: lineCount(session.fixture.readme.changed),
          },
        },
        expected: {
          ...(await expectation(session)),
          files: [{ path, fingerprint: await fingerprintOf(session, path) }],
        },
      },
    },
    202,
  );
  await settledReceipt(session, requestId);
  const discarded = (
    await session.git(
      'for-each-ref',
      '--format=%(objectname)',
      'refs/porcelain/discarded',
    )
  ).trim();

  const response = await session.send(status(session));

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect(record(body.branch).discarded).toStrictEqual([
    { oid: discarded, path: session.fixture.readme.path, kind: 'hunk' },
  ]);
  expect(body.changes).toStrictEqual([]);
});

test('the git status lists a stash first with its message', async ({
  session,
}) => {
  await session.writeFile(session.fixture.readme.path, 'Parked\n');
  await session.git('stash', 'push', '-m', 'Parked work');
  const stash = (await session.git('rev-parse', 'stash@{0}')).trim();

  const response = await session.send(status(session));

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect(list(record(body.branch).stashes)[0]).toStrictEqual({
    oid: stash,
    message: `On ${session.fixture.branch}: Parked work`,
  });
  expect(body.changes).toStrictEqual([]);
});

test('the git status of an unknown worktree is not found, and a malformed worktree id is refused', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/git/status`,
    }),
    await session.send({
      method: 'GET',
      path: '/api/worktrees/not-an-id/git/status',
    }),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(worktreeNotFound);
  expect(responses[1]?.status).toBe(400);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
});
