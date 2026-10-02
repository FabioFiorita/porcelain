import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { liveNoticeSchema } from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  unauthenticated,
  upgradeHeaders,
} from '../scripts/feature.ts';
import {
  list,
  record,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import {
  expectation,
  fingerprintOf,
  gitPath,
  inventory,
  watching,
  worktreePath,
} from '../scripts/fixture.ts';
import { sampleReview } from '../../../../apps/server/spec/kit/requests.ts';

const headReflog = '.git/logs/HEAD';

const worktreeNotice = (session: Session, change: string) => ({
  type: 'worktree',
  projectId: session.projectId,
  worktreeId: session.worktreeId,
  change,
});
const isWorktree = (change: string) => (notice: Record<string, unknown>) =>
  notice.type === 'worktree' && notice.change === change;

export default defineFeature({
  feature: 'access.live-updates',
  reaches: 'GET /api/live',
  paired: false,
  intent: 'observed',
  behaviour:
    "A paired viewer opens a same-origin WebSocket at `/api/live`, is told it is ready, and subscribes to projects and worktrees. It is then told what changed but not the new data, so it knows what to read again: the inventory, a project's preferences, or a worktree's files, Git state, reviewed marks, comments or review. A Git action is the exception: its notice carries the receipt. Watching a repository never opens its reflogs, so a commit whose reflog is a named pipe stays stuck until its deadline ends it interrupted, and later Git changes are still announced. Upgrades without a credential or from another origin are refused; a malformed subscription closes the connection.",
  cases: [
    defineCase({
      name: 'inventory change is announced',
      setup: watching,
      request: (session) => ({
        method: 'PATCH',
        path: `/api/projects/${session.projectId}`,
        body: { name: 'Announced' },
      }),
      async expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'body',
          { id: session.projectId, name: 'Announced' },
          response.body,
        );
        const notice = await state.next((entry) => entry.type === 'inventory');
        check('notice', { type: 'inventory' }, notice);
        checkContract('contract', liveNoticeSchema, notice);
      },
    }),
    defineCase({
      name: 'project preference change is announced',
      setup: watching,
      request: (session) => ({
        method: 'PUT',
        path: `/api/projects/${session.projectId}/file-preferences`,
        body: {
          path: session.fixture.readme.path,
          flag: 'pinned',
          value: true,
        },
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'body',
          {
            preferences: [
              {
                path: session.fixture.readme.path,
                pinned: true,
                hidden: false,
              },
            ],
          },
          response.body,
        );
        const notice = await state.next((entry) => entry.type === 'project');
        check(
          'notice',
          {
            type: 'project',
            projectId: session.projectId,
            change: 'preferences',
          },
          notice,
        );
      },
    }),
    defineCase({
      name: 'worktree comment change is announced',
      setup: watching,
      request: (session) => ({
        method: 'POST',
        path: worktreePath(session, '/comments'),
        body: {
          anchor: { kind: 'file', filePath: session.fixture.readme.path },
          body: 'Announced',
        },
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'the written thread',
          'Announced',
          record(list(record(response.body).messages)[0]).body,
        );
        check(
          'notice',
          worktreeNotice(session, 'comments'),
          await state.next(isWorktree('comments')),
        );
      },
    }),
    defineCase({
      name: 'worktree file change is announced',
      setup: watching,
      request: (session) => ({
        method: 'POST',
        path: worktreePath(session, '/files'),
        body: { kind: 'create', path: 'announced.md', entryKind: 'file' },
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check('body', { path: 'announced.md' }, response.body);
        check(
          'notice',
          worktreeNotice(session, 'files'),
          await state.next(isWorktree('files')),
        );
      },
    }),
    defineCase({
      name: 'a Git action is announced with its receipt and its Git change',
      async setup(session) {
        const path = 'announced.md';
        return {
          connection: await watching(session),
          requestId: randomUUID(),
          path,
          expected: {
            ...(await expectation(session)),
            files: [{ path, fingerprint: await fingerprintOf(session, path) }],
          },
        };
      },
      request: (session, state) => ({
        method: 'POST',
        path: gitPath(session, '/actions'),
        body: {
          requestId: state.requestId,
          input: {
            action: 'commit',
            message: 'Announce the note',
            paths: [state.path],
          },
          expected: state.expected,
        },
      }),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, state: 'running' },
          response.body,
        );
        const settled = await state.connection.next(
          (entry) =>
            entry.type === 'git-action' &&
            record(entry.receipt).state === 'succeeded',
        );
        checkContract('git-action contract', liveNoticeSchema, settled);
        checkPartial(
          'git-action notice',
          {
            type: 'git-action',
            projectId: session.projectId,
            worktreeId: session.worktreeId,
            receipt: {
              requestId: state.requestId,
              action: 'commit',
              state: 'succeeded',
            },
          },
          settled,
        );
        check(
          'git notice',
          worktreeNotice(session, 'git'),
          await state.connection.next(isWorktree('git')),
        );
      },
    }),
    defineCase({
      name: 'a published review is announced',
      setup: watching,
      request: (session) => ({
        method: 'PUT',
        path: worktreePath(session, '/review'),
        body: sampleReview(session, 0, randomUUID(), randomUUID()),
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'first revision',
          1,
          record(record(response.body).review).revision,
        );
        check(
          'notice',
          worktreeNotice(session, 'review'),
          await state.next(isWorktree('review')),
        );
      },
    }),
    defineCase({
      name: 'a reviewed mark is announced',
      async setup(session) {
        return {
          connection: await watching(session),
          fingerprint: await fingerprintOf(
            session,
            session.fixture.readme.path,
          ),
        };
      },
      request: (session, state) => ({
        method: 'PUT',
        path: worktreePath(session, '/reviewed'),
        body: {
          path: session.fixture.readme.path,
          reviewed: true,
          fingerprint: state.fingerprint,
        },
      }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'marked',
          [session.fixture.readme.path],
          list(record(response.body).marks).map((mark) => record(mark).path),
        );
        check(
          'notice',
          worktreeNotice(session, 'reviewed'),
          await state.connection.next(isWorktree('reviewed')),
        );
      },
    }),
    defineCase({
      name: 'the watcher never opens a reflog, so a commit whose reflog is a named pipe stays stuck',
      async setup(session) {
        const connection = await watching(session);
        await session.remove(headReflog);
        await session.fifo(headReflog);
        await delay(300);
        const path = 'piped.md';
        await session.writeFile(path, 'Piped\n');
        return {
          connection,
          requestId: randomUUID(),
          path,
          expected: {
            ...(await expectation(session)),
            files: [{ path, fingerprint: await fingerprintOf(session, path) }],
          },
        };
      },
      request: (session, state) => ({
        method: 'POST',
        path: gitPath(session, '/actions'),
        body: {
          requestId: state.requestId,
          input: { action: 'commit', message: 'Piped', paths: [state.path] },
          expected: state.expected,
        },
      }),
      async expect({ response, state, session, check, checkPartial }) {
        check('accepted', 202, response.status);
        checkPartial(
          'running receipt',
          { requestId: state.requestId, state: 'running' },
          response.body,
        );
        checkPartial(
          'git-action notice',
          {
            type: 'git-action',
            receipt: { requestId: state.requestId, state: 'interrupted' },
          },
          await state.connection.next(
            (entry) =>
              entry.type === 'git-action' &&
              record(entry.receipt).state !== 'running',
          ),
        );
        await session.git('branch', 'after-the-pipe');
        check(
          'later Git change',
          worktreeNotice(session, 'git'),
          await state.connection.next(isWorktree('git')),
        );
        await session.remove(headReflog);
        await session.remove('.git/index.lock');
        await session.remove(`.git/refs/heads/${session.fixture.branch}.lock`);
      },
    }),
    defineCase({
      name: 'invalid subscription closes the connection',
      async setup(session) {
        const connection = await session.live();
        await connection.next((notice) => notice.type === 'ready');
        connection.send({
          type: 'subscribe',
          projects: ['not-a-uuid'],
          worktrees: [],
        });
        return { connection, inventory: await inventory(session) };
      },
      request: () => ({ method: 'GET', path: '/api/inventory' }),
      async expect({ response, state, check }) {
        check(
          'close',
          { code: 1008, reason: 'Invalid subscription' },
          await state.connection.closed(),
        );
        check('the viewer can still read', 200, response.status);
        check('the inventory is unchanged', state.inventory, response.body);
      },
    }),
    defineCase({
      name: 'upgrade without a credential',
      request: (session) => ({
        method: 'GET',
        path: '/api/live',
        auth: 'none',
        headers: upgradeHeaders(session.address),
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
      },
    }),
    defineCase({
      name: 'upgrade from another origin',
      request: (session) => ({
        method: 'GET',
        path: '/api/live',
        headers: {
          ...upgradeHeaders(session.address),
          origin: 'http://elsewhere.example',
        },
      }),
      expect({ response, check }) {
        check('status', 403, response.status);
        check(
          'error body',
          apiError(
            403,
            'Forbidden',
            'The origin http://elsewhere.example cannot write here',
          ),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'upgrade without an origin',
      request: (session) => {
        const { origin: _origin, ...headers } = upgradeHeaders(session.address);
        return { method: 'GET', path: '/api/live', headers };
      },
      expect({ response, check }) {
        check('status', 403, response.status);
        check(
          'error body',
          apiError(403, 'Forbidden', 'The Origin header is required'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'accepted upgrade',
      request: (session) => ({
        method: 'GET',
        path: '/api/live',
        headers: upgradeHeaders(session.address),
      }),
      expect({ response, check }) {
        check('switches protocols', 101, response.status);
        check('no HTTP body', undefined, response.body);
      },
    }),
  ],
});
