import { randomUUID } from 'node:crypto';
import { liveNoticeSchema } from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  list,
  record,
  unauthenticated,
  upgradeHeaders,
  type Session,
} from '../scripts/feature.ts';
import {
  expectation,
  fingerprintOf,
  gitPath,
  inventory,
  sampleReview,
  watching,
  worktreePath,
} from '../scripts/fixture.ts';

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
    "A paired viewer opens a same-origin WebSocket at `/api/live`, is told it is ready, and subscribes to projects and worktrees. It is then told what changed but not the new data, so it knows what to read again: the inventory, a project's preferences, or a worktree's files, Git state, reviewed marks, comments or review. A Git action is the exception: its notice carries the receipt. Upgrades without a credential or from another origin are refused; a malformed subscription closes the connection.",
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
        check('one thread written', 1, list(response.body).length);
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
        return {
          connection: await watching(session),
          requestId: randomUUID(),
          expected: await expectation(session),
        };
      },
      request: (session, state) => ({
        method: 'POST',
        path: gitPath(session, '/actions'),
        body: {
          requestId: state.requestId,
          input: {
            action: 'create-branch',
            branch: 'announced',
            switchTo: false,
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
              action: 'create-branch',
              state: 'succeeded',
              result: { branch: 'announced' },
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
