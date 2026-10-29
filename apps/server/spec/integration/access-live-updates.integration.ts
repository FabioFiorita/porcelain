import { liveNoticeSchema } from '@porcelain/contracts/access';
import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { expect } from 'vitest';
import { apiError, unauthenticated, upgradeHeaders } from '../kit/answers.ts';
import {
  expectation,
  fingerprintOf,
  inventory,
  receiptOf,
  watching,
} from '../kit/reads.ts';
import {
  commitReviewFixture,
  gitPath,
  read,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { liveNotices } from '../kit/live-notices.ts';
import {
  list,
  record,
  text,
  type Session,
  type HttpResponse,
} from '../kit/session.ts';

async function mutationBeforeDeadline(operation: Promise<HttpResponse>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Live publication stalled a product writer')),
          2000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const worktreeNotice = (session: Session, change: string) => ({
  type: 'worktree',
  projectId: session.projectId,
  worktreeId: session.worktreeId,
  change,
});
const isWorktree = (change: string) => (notice: Record<string, unknown>) =>
  notice.type === 'worktree' && notice.change === change;

test('a paired viewer requesting live updates without an upgrade gets an empty not-found response', async ({
  session,
  server,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/live',
    headers: { origin: session.address },
  });

  expect(response.status).toBe(404);
  expect(response.body).toBeUndefined();
  expect(await server.requestedRoutes()).toContain('GET /api/live');
});

test('every subscription is confirmed, including an empty replacement', async ({
  session,
}) => {
  const connection = await session.live();
  expect(await connection.next(() => true)).toStrictEqual({ type: 'ready' });
  await connection.follow({
    projects: [session.projectId],
    worktrees: [],
  });
  await connection.follow({ projects: [], worktrees: [] });

  for (let index = 0; index < 2; index += 1) {
    const notice = await connection.next(() => true);
    expect(notice).toStrictEqual({ type: 'subscribed' });
    expect(notice).toEqual(
      expect.schemaMatching(
        Schema.toStandardSchemaV1(Schema.toEncoded(liveNoticeSchema)),
      ),
    );
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

test('a file rewritten outside right after a save is announced by its watcher', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  const opened = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path },
  });
  const connection = await watching(session);
  const saved = await session.send({
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: {
      kind: 'write',
      path,
      text: 'Saved in Porcelain\n',
      expectedFingerprint: text(opened.contentFingerprint),
    },
  });
  expect(saved.status).toBe(200);
  expect(await connection.next(isWorktree('files')), 'the edit').toStrictEqual(
    worktreeNotice(session, 'files'),
  );
  expect(
    await connection.next(isWorktree('files')),
    "the save's watcher echo",
  ).toStrictEqual(worktreeNotice(session, 'files'));

  await session.writeFile(path, 'Rewritten outside\n');

  expect(await connection.next(isWorktree('files'))).toStrictEqual(
    worktreeNotice(session, 'files'),
  );
});

test('an explicitly followed ignored file is watched before its subscription is confirmed', async ({
  session,
}) => {
  await session.writeFile('.gitignore', 'agent-cache/\n');
  const created = await session.send({
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: { kind: 'create', path: 'agent-cache', entryKind: 'directory' },
  });
  expect(created.status).toBe(200);
  await session.writeFile('agent-cache/state.txt', 'Before confirmation\n');
  const connection = await session.live();
  expect(await connection.next(() => true)).toStrictEqual({ type: 'ready' });
  await connection.follow({
    projects: [],
    worktrees: [
      {
        projectId: session.projectId,
        worktreeId: session.worktreeId,
        paths: ['agent-cache/state.txt'],
      },
    ],
  });
  expect(await connection.next(() => true)).toStrictEqual({
    type: 'subscribed',
  });
  await session.writeFile('agent-cache/state.txt', 'After confirmation\n');
  expect(await connection.next(isWorktree('files'))).toStrictEqual(
    worktreeNotice(session, 'files'),
  );
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

test('a Git action is announced to a watching viewer with its receipt and its Git change in either order', async ({
  session,
}) => {
  const path = 'git-announced.md';
  await session.writeFile(path, 'A change to commit.\n');
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
  const [settled, changed] = await liveNotices(connection, [
    (entry) =>
      entry.type === 'git-action' &&
      record(entry.receipt).requestId === requestId &&
      record(entry.receipt).state === 'succeeded',
    isWorktree('git'),
  ]);
  expect(settled).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(liveNoticeSchema)),
    ),
  );
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
  expect(changed).toStrictEqual(worktreeNotice(session, 'git'));
});

test("publishing a review tells a watching viewer the worktree's review changed", async ({
  session,
}) => {
  const connection = await watching(session);

  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
  await commitReviewFixture(session);
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
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.changed}A new change to mark.\n`,
  );
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

test('RPC rejects a malformed subscription before following it and the viewer can still read', async ({
  session,
}) => {
  const connection = await session.live();
  await connection.next((notice) => notice.type === 'ready');
  const rejected = await connection.invalidFollow({
    projects: ['not-a-uuid'],
    worktrees: [],
  });
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
  });

  expect(rejected).toMatchObject({
    _tag: 'Exit',
    requestId: '999999',
    exit: { _tag: 'Failure', cause: [{ _tag: 'Die' }] },
  });
  await connection.follow({ projects: [], worktrees: [] });
  expect(
    await connection.next((notice) => notice.type === 'subscribed'),
  ).toStrictEqual({ type: 'subscribed' });
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

test.for([
  {
    mode: 'unopened notices',
    requestId: '97271928-25ef-44f6-ad5d-a29bfb635d64',
  },
  {
    mode: 'unacknowledged notices',
    requestId: 'aff3f13c-1847-49f8-a71c-4d0768d02b5f',
  },
])(
  'a pong-responsive peer with $mode cannot stall writers or two healthy viewers and recovers by resubscribing',
  async ({ mode, requestId }, { session }) => {
    const healthy = [await watching(session), await watching(session)];
    const issued = await session.read({
      method: 'POST',
      path: '/api/live/tickets',
      headers: { origin: session.address },
    });
    const ticket = text(record(issued.body).ticket);
    session.secret(ticket);
    const url = new URL('/api/live', session.address);
    url.protocol = 'ws:';
    url.searchParams.set('ticket', ticket);
    const stalled = new WebSocket(url, {
      origin: session.address,
      autoPong: true,
    });
    stalled.on('error', () => undefined);
    try {
      await once(stalled, 'open');
      if (mode === 'unacknowledged notices')
        stalled.send(
          JSON.stringify({
            _tag: 'Request',
            id: '1',
            tag: 'notices',
            payload: null,
            headers: [],
          }),
        );
      const followed = new Promise<void>((resolveFollow) => {
        const receive = (data: WebSocket.RawData) => {
          const frame = record(
            JSON.parse(
              new TextDecoder().decode(
                Array.isArray(data) ? Buffer.concat(data) : data,
              ),
            ),
          );
          if (frame._tag === 'Exit' && frame.requestId === '2') {
            stalled.off('message', receive);
            resolveFollow();
          }
        };
        stalled.on('message', receive);
      });
      stalled.send(
        JSON.stringify({
          _tag: 'Request',
          id: '2',
          tag: 'follow',
          payload: {
            projects: [session.projectId],
            worktrees: [
              {
                projectId: session.projectId,
                worktreeId: session.worktreeId,
                paths: [],
              },
            ],
          },
          headers: [],
        }),
      );
      await followed;
      const path = `lagging-viewer-${mode}.md`;
      await session.writeFile(path, 'A durable change.\n');
      const response = await session.send({
        method: 'POST',
        path: gitPath(session, '/actions'),
        body: {
          requestId,
          input: {
            action: 'commit',
            message: 'Keep a durable receipt',
            paths: [path],
          },
          expected: {
            ...(await expectation(session)),
            files: [{ path, fingerprint: await fingerprintOf(session, path) }],
          },
        },
      });
      expect(response.status).toBe(202);
      for (const connection of healthy)
        expect(
          await connection.next(
            (notice) =>
              notice.type === 'git-action' &&
              record(notice.receipt).requestId === requestId &&
              record(notice.receipt).state === 'succeeded',
          ),
        ).toMatchObject({
          type: 'git-action',
          receipt: { requestId, state: 'succeeded' },
        });
      for (let index = 0; index < 600; index += 1) {
        const updated = await mutationBeforeDeadline(
          session.send({
            method: 'PATCH',
            path: `/api/projects/${session.projectId}`,
            body: { name: `${mode} ${index % 2 === 0 ? 'A' : 'B'}` },
          }),
        );
        expect(updated.status).toBe(200);
        for (const connection of healthy)
          expect(
            await connection.next((notice) => notice.type === 'inventory'),
          ).toStrictEqual({ type: 'inventory' });
      }
      await expect.poll(() => stalled.readyState).toBe(WebSocket.CLOSED);
      const recovered = await watching(session);
      try {
        const projects = list(record(await inventory(session)).projects).map(
          record,
        );
        expect(
          projects.find((project) => project.id === session.projectId),
        ).toMatchObject({
          id: session.projectId,
          name: `${mode} B`,
        });
        expect(await receiptOf(session, requestId)).toMatchObject({
          requestId,
          state: 'succeeded',
          action: 'commit',
        });
        const updated = await session.send({
          method: 'PATCH',
          path: `/api/projects/${session.projectId}`,
          body: { name: 'Recovered' },
        });
        expect(updated.status).toBe(200);
        for (const connection of [...healthy, recovered])
          expect(
            await connection.next((notice) => notice.type === 'inventory'),
          ).toStrictEqual({ type: 'inventory' });
      } finally {
        await recovered.close();
      }
    } finally {
      if (stalled.readyState !== WebSocket.CLOSED) {
        const closed = once(stalled, 'close');
        stalled.terminate();
        await closed;
      }
      for (const connection of healthy) await connection.close();
    }
  },
);
