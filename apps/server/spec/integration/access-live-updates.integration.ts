import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { liveNoticeSchema } from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, unauthenticated, upgradeHeaders } from '../kit/answers.ts';
import {
  expectation,
  fingerprintOf,
  inventory,
  watching,
} from '../kit/reads.ts';
import { gitPath, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

const HEAD_REFLOG = '.git/logs/HEAD';

const worktreeNotice = (session: Session, change: string) => ({
  type: 'worktree',
  projectId: session.projectId,
  worktreeId: session.worktreeId,
  change,
});
const isWorktree = (change: string) => (notice: Record<string, unknown>) =>
  notice.type === 'worktree' && notice.change === change;

test('every subscription is confirmed, including an empty replacement', async ({
  session,
}) => {
  const connection = await session.live();
  expect(await connection.next(() => true)).toStrictEqual({ type: 'ready' });
  connection.send({
    type: 'subscribe',
    projects: [session.projectId],
    worktrees: [],
  });
  connection.send({ type: 'subscribe', projects: [], worktrees: [] });

  for (let index = 0; index < 2; index += 1) {
    const notice = await connection.next(() => true);
    expect(notice).toStrictEqual({ type: 'subscribed' });
    expect(notice).toEqual(expect.schemaMatching(liveNoticeSchema));
  }
});

test('a file changed immediately after confirmation is announced by its watcher', async ({
  session,
}) => {
  const connection = await watching(session);

  await session.writeFile(session.fixture.readme.path, 'After confirmation\n');

  expect(await connection.next(isWorktree('files'))).toStrictEqual(
    worktreeNotice(session, 'files'),
  );
});

test('renaming a project tells a watching viewer the inventory changed', async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send({
    method: 'PATCH',
    path: `/api/projects/${session.projectId}`,
    body: { name: 'Announced' },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    id: session.projectId,
    name: 'Announced',
  });
  const notice = await connection.next((entry) => entry.type === 'inventory');
  expect(notice).toStrictEqual({ type: 'inventory' });
  expect(notice).toEqual(expect.schemaMatching(liveNoticeSchema));
});

test("pinning a file tells a watching viewer the project's preferences changed", async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send({
    method: 'PUT',
    path: `/api/projects/${session.projectId}/file-preferences`,
    body: {
      path: session.fixture.readme.path,
      flag: 'pinned',
      value: true,
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    preferences: [
      {
        path: session.fixture.readme.path,
        pinned: true,
        hidden: false,
      },
    ],
  });
  expect(
    await connection.next((entry) => entry.type === 'project'),
  ).toStrictEqual({
    type: 'project',
    projectId: session.projectId,
    change: 'preferences',
  });
});

test("writing a comment tells a watching viewer the worktree's comments changed", async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: { kind: 'file', filePath: session.fixture.readme.path },
      body: 'Announced',
    },
  });

  expect(response.status).toBe(200);
  expect(record(list(record(response.body).messages)[0]).body).toBe(
    'Announced',
  );
  expect(await connection.next(isWorktree('comments'))).toStrictEqual(
    worktreeNotice(session, 'comments'),
  );
});

test("creating a file tells a watching viewer the worktree's files changed", async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: { kind: 'create', path: 'announced.md', entryKind: 'file' },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ path: 'announced.md' });
  expect(await connection.next(isWorktree('files'))).toStrictEqual(
    worktreeNotice(session, 'files'),
  );
});

test('a Git action is announced to a watching viewer with its receipt and then its Git change', async ({
  session,
}) => {
  const path = 'announced.md';
  const connection = await watching(session);
  const requestId = randomUUID();
  const expected = {
    ...(await expectation(session)),
    files: [{ path, fingerprint: await fingerprintOf(session, path) }],
  };

  const response = await session.send({
    method: 'POST',
    path: gitPath(session, '/actions'),
    body: {
      requestId,
      input: {
        action: 'commit',
        message: 'Announce the note',
        paths: [path],
      },
      expected,
    },
  });

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({ requestId, state: 'running' });
  const settled = await connection.next(
    (entry) =>
      entry.type === 'git-action' &&
      record(entry.receipt).state === 'succeeded',
  );
  expect(settled).toEqual(expect.schemaMatching(liveNoticeSchema));
  expect(settled).toMatchObject({
    type: 'git-action',
    projectId: session.projectId,
    worktreeId: session.worktreeId,
    receipt: {
      requestId,
      action: 'commit',
      state: 'succeeded',
    },
  });
  expect(await connection.next(isWorktree('git'))).toStrictEqual(
    worktreeNotice(session, 'git'),
  );
});

test("publishing a review tells a watching viewer the worktree's review changed", async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, randomUUID(), randomUUID()),
  });

  expect(response.status).toBe(200);
  expect(record(record(response.body).review).revision).toBe(1);
  expect(await connection.next(isWorktree('review'))).toStrictEqual(
    worktreeNotice(session, 'review'),
  );
});

test("marking a file reviewed tells a watching viewer the worktree's reviewed marks changed", async ({
  session,
}) => {
  const connection = await watching(session);
  const fingerprint = await fingerprintOf(session, session.fixture.readme.path);

  const response = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/reviewed'),
    body: {
      path: session.fixture.readme.path,
      reviewed: true,
      fingerprint,
    },
  });

  expect(response.status).toBe(200);
  expect(
    list(record(response.body).marks).map((mark) => record(mark).path),
  ).toStrictEqual([session.fixture.readme.path]);
  expect(await connection.next(isWorktree('reviewed'))).toStrictEqual(
    worktreeNotice(session, 'reviewed'),
  );
});

test('watching never opens a reflog, so a commit whose reflog is a named pipe ends interrupted and later Git changes are still announced', async ({
  session,
}) => {
  const connection = await watching(session);
  await session.remove(HEAD_REFLOG);
  await session.fifo(HEAD_REFLOG);
  await delay(300);
  const path = 'piped.md';
  await session.writeFile(path, 'Piped\n');
  const requestId = randomUUID();
  const expected = {
    ...(await expectation(session)),
    files: [{ path, fingerprint: await fingerprintOf(session, path) }],
  };

  const response = await session.send({
    method: 'POST',
    path: gitPath(session, '/actions'),
    body: {
      requestId,
      input: { action: 'commit', message: 'Piped', paths: [path] },
      expected,
    },
  });

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({ requestId, state: 'running' });
  expect(
    await connection.next(
      (entry) =>
        entry.type === 'git-action' &&
        record(entry.receipt).state !== 'running',
    ),
  ).toMatchObject({
    type: 'git-action',
    receipt: { requestId, state: 'interrupted' },
  });
  await session.git('branch', 'after-the-pipe');
  expect(await connection.next(isWorktree('git'))).toStrictEqual(
    worktreeNotice(session, 'git'),
  );
  await session.remove(HEAD_REFLOG);
  await session.remove('.git/index.lock');
  await session.remove(`.git/refs/heads/${session.fixture.branch}.lock`);
});

test('a malformed subscription closes the connection and the viewer can still read', async ({
  session,
}) => {
  const connection = await session.live();
  await connection.next((notice) => notice.type === 'ready');
  connection.send({
    type: 'subscribe',
    projects: ['not-a-uuid'],
    worktrees: [],
  });
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
  });

  expect(await connection.closed()).toStrictEqual({
    code: 1008,
    reason: 'Invalid subscription',
  });
  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual(before);
});

test('opening live updates without a credential is refused', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/live',
    auth: 'none',
    headers: upgradeHeaders(session.address),
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
});

test('opening live updates from another origin is refused', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/live',
    headers: {
      ...upgradeHeaders(session.address),
      origin: 'http://elsewhere.example',
    },
  });

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      'The origin http://elsewhere.example cannot write here',
    ),
  );
});

test('opening live updates without an origin is refused', async ({
  session,
}) => {
  const headers = Object.fromEntries(
    Object.entries(upgradeHeaders(session.address)).filter(
      ([name]) => name !== 'origin',
    ),
  );

  const response = await session.send({
    method: 'GET',
    path: '/api/live',
    headers,
  });

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(403, 'Forbidden', 'The Origin header is required'),
  );
});

test('a paired viewer opening live updates from the same origin switches protocols', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/live',
    headers: upgradeHeaders(session.address),
  });

  expect(response.status).toBe(101);
  expect(response.body).toBeUndefined();
});
