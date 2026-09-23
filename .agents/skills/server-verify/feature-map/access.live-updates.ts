import { liveNoticeSchema } from '../../../../packages/contracts/src/access/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  unauthenticated,
  upgradeHeaders,
  type LiveConnection,
  type Session,
} from '../scripts/feature.ts';
import { setTimeout as delay } from 'node:timers/promises';
import { worktreePath } from '../scripts/fixture.ts';

async function subscribed(session: Session): Promise<LiveConnection> {
  const connection = await session.live();
  await connection.next((notice) => notice.type === 'ready');
  connection.send({
    type: 'subscribe',
    projects: [session.projectId],
    worktrees: [
      {
        projectId: session.projectId,
        worktreeId: session.worktreeId,
        paths: ['README.md'],
      },
    ],
  });
  await delay(300);
  return connection;
}

export default defineFeature({
  feature: 'access.live-updates',
  reaches: 'GET /api/live',
  intent: 'observed',
  behaviour:
    'A paired viewer opens a same-origin WebSocket at `/api/live`, is told it is ready, and subscribes to projects and worktrees. It is then notified, without payload, when the inventory, a project (files or preferences) or a worktree (files, git, reviewed marks, comments, review) changes, so it knows what to read again. Upgrades without a credential or from another origin are refused; a malformed subscription closes the connection.',
  cases: [
    defineCase({
      name: 'inventory change is announced',
      setup: subscribed,
      request: (session) => ({
        method: 'PATCH',
        path: `/api/projects/${session.projectId}`,
        body: { name: 'Announced' },
      }),
      async expect({ state, check, checkContract }) {
        const notice = await state.next((entry) => entry.type === 'inventory');
        check('notice', { type: 'inventory' }, notice);
        checkContract('contract', liveNoticeSchema, notice);
      },
    }),
    defineCase({
      name: 'project preference change is announced',
      setup: subscribed,
      request: (session) => ({
        method: 'PUT',
        path: `/api/projects/${session.projectId}/file-preferences`,
        body: { path: 'README.md', flag: 'pinned', value: true },
      }),
      async expect({ state, session, check }) {
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
      setup: subscribed,
      request: (session) => ({
        method: 'POST',
        path: worktreePath(session, '/comments'),
        body: {
          anchor: { kind: 'file', filePath: 'README.md' },
          body: 'Announced',
        },
      }),
      async expect({ state, session, check }) {
        const notice = await state.next(
          (entry) => entry.type === 'worktree' && entry.change === 'comments',
        );
        check(
          'notice',
          {
            type: 'worktree',
            projectId: session.projectId,
            worktreeId: session.worktreeId,
            change: 'comments',
          },
          notice,
        );
      },
    }),
    defineCase({
      name: 'invalid subscription closes the connection',
      setup: async (session) => {
        const connection = await session.live();
        await connection.next((notice) => notice.type === 'ready');
        connection.send({
          type: 'subscribe',
          projects: ['not-a-uuid'],
          worktrees: [],
        });
        return connection;
      },
      request: () => ({ method: 'GET', path: '/api/health', auth: 'none' }),
      async expect({ state, check }) {
        check(
          'close',
          { code: 1008, reason: 'Invalid subscription' },
          await state.closed(),
        );
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
      },
    }),
  ],
});
