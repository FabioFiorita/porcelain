import { setTimeout as delay } from 'node:timers/promises';
import {
  issueLiveTicketResponseSchema,
  liveNoticeSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  record,
  text,
  unauthenticated,
  upgradeHeaders,
  type HttpRequest,
  type Session,
} from '../scripts/feature.ts';
import { liveTicketForm, pairDevice, read } from '../scripts/fixture.ts';

const app = 'http://app.example';
const tickets = '/api/live/tickets';

async function ticketFor(session: Session, credential?: string) {
  const issued = await read(session, {
    method: 'POST',
    path: tickets,
    headers: { origin: app },
    ...(credential === undefined ? {} : { auth: { bearer: credential } }),
  });
  return { ticket: text(issued.ticket), expiresAt: text(issued.expiresAt) };
}

function upgradeWith(
  session: Session,
  ticket: string,
  origin: string | undefined = app,
  auth: HttpRequest['auth'] = 'none',
): HttpRequest {
  const { origin: _origin, ...headers } = upgradeHeaders(session.address);
  return {
    method: 'GET',
    path: '/api/live',
    query: { ticket },
    auth,
    headers: origin === undefined ? headers : { ...headers, origin },
  };
}

function checkRefused(
  check: (name: string, expected: unknown, actual: unknown) => void,
  response: { status: number; body: unknown } | undefined,
  name = 'upgrade',
) {
  check(`${name} status`, 401, response?.status);
  check(`${name} body`, unauthenticated, response?.body);
}

export default defineFeature({
  feature: 'access.live-tickets',
  reaches: ['POST /api/live/tickets', 'GET /api/live'],
  paired: false,
  intent: 'intended',
  behaviour:
    'A browser cannot put a bearer credential on a WebSocket, so a paired device on another origin asks for a live ticket and opens `/api/live?ticket=…` with it. A ticket is issued only to a paired device, lives for a few seconds, and works once, over the route it was issued on, for a device that is still paired. The live connection it opens needs no same origin and then behaves like any other: it is told it is ready, hears what changed, and closes when its device is revoked. A ticket that was used, expired, belongs to a revoked device or was never issued is refused, and a ticket upgrade never falls back to a bearer credential or a cookie.',
  cases: [
    defineCase({
      name: 'a paired device on another origin gets a ticket and nobody else does',
      request: () => [
        { method: 'POST', path: tickets, headers: { origin: app } },
        {
          method: 'POST',
          path: tickets,
          headers: { origin: app },
          auth: 'none',
        },
        { method: 'POST', path: tickets, auth: 'none' },
      ],
      expect({ responses, check, checkContract, checkMatch }) {
        const [issued, crossOrigin, anonymous] = responses;
        check('status', 200, issued?.status);
        checkContract('contract', issueLiveTicketResponseSchema, issued?.body);
        checkMatch(
          'a live ticket',
          liveTicketForm,
          record(issued?.body).ticket,
        );
        checkMatch(
          'an expiry instant',
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          record(issued?.body).expiresAt,
        );
        check(
          'readable from any origin',
          '*',
          issued?.headers['access-control-allow-origin'],
        );
        check(
          'without a credential from the app status',
          403,
          crossOrigin?.status,
        );
        check(
          'without a credential from the app body',
          apiError(403, 'Forbidden', `The origin ${app} cannot write here`),
          crossOrigin?.body,
        );
        checkRefused(check, anonymous, 'without a credential');
      },
    }),
    defineCase({
      name: 'a ticket opens live updates from another origin that close when the device is revoked',
      async setup(session) {
        const device = await pairDevice(session, 'Desktop app');
        const { ticket } = await ticketFor(session, device.credential);
        const connection = await session.live({ ticket, origin: app });
        const ready = await connection.next(
          (notice) => notice.type === 'ready',
        );
        connection.send({
          type: 'subscribe',
          projects: [session.projectId],
          worktrees: [],
        });
        await delay(300);
        return { device, connection, ready };
      },
      request: (session, state) => [
        {
          method: 'PATCH',
          path: `/api/projects/${session.projectId}`,
          body: { name: 'Announced' },
        },
        {
          method: 'POST',
          path: '/access/revoke',
          target: 'owner',
          body: { id: state.device.deviceId },
        },
      ],
      async expect({ responses, state, session, check, checkContract }) {
        const [renamed, revoked] = responses;
        check('ready', { type: 'ready' }, state.ready);
        check('rename status', 200, renamed?.status);
        check(
          'rename body',
          { id: session.projectId, name: 'Announced' },
          renamed?.body,
        );
        const notice = await state.connection.next(
          (entry) => entry.type === 'inventory',
        );
        check('notice', { type: 'inventory' }, notice);
        checkContract('notice contract', liveNoticeSchema, notice);
        check('revoke status', 200, revoked?.status);
        check('revoked', { revoked: true, kind: 'device' }, revoked?.body);
        check(
          'the live connection closes',
          { code: 4001, reason: 'Device access revoked' },
          await state.connection.closed(),
        );
      },
    }),
    defineCase({
      name: 'a ticket upgrade needs no origin, as a native client sends it',
      setup: (session) => ticketFor(session),
      request: (session, state) =>
        upgradeWith(session, state.ticket, undefined),
      expect({ response, check }) {
        check('switches protocols', 101, response.status);
        check('no HTTP body', undefined, response.body);
      },
    }),
    defineCase({
      name: 'a ticket works once',
      async setup(session) {
        const { ticket } = await ticketFor(session);
        const connection = await session.live({ ticket, origin: app });
        await connection.next((notice) => notice.type === 'ready');
        return { ticket };
      },
      request: (session, state) => [
        upgradeWith(session, state.ticket),
        upgradeWith(session, state.ticket, undefined),
      ],
      expect({ responses, check }) {
        checkRefused(check, responses[0], 'from the app');
        checkRefused(check, responses[1], 'without an origin');
      },
    }),
    defineCase({
      name: 'a ticket expires',
      async setup(session) {
        const issued = await ticketFor(session);
        await delay(
          Math.max(0, Date.parse(issued.expiresAt) - Date.now()) + 100,
        );
        return issued;
      },
      request: (session, state) => upgradeWith(session, state.ticket),
      expect({ response, check }) {
        checkRefused(check, response);
      },
    }),
    defineCase({
      name: 'the ticket of a revoked device is refused',
      async setup(session) {
        const device = await pairDevice(session, 'Revoked app');
        const { ticket } = await ticketFor(session, device.credential);
        await read(session, {
          method: 'POST',
          path: '/access/revoke',
          target: 'owner',
          body: { id: device.deviceId },
        });
        return { ticket };
      },
      request: (session, state) => upgradeWith(session, state.ticket),
      expect({ response, check }) {
        checkRefused(check, response);
      },
    }),
    defineCase({
      name: 'a ticket that was never issued is refused without falling back to the bearer credential',
      request: (session) => [
        upgradeWith(session, 'pct_not-a-ticket', app, 'paired'),
        upgradeWith(
          session,
          'pct_not-a-ticket',
          new URL(session.address).origin,
          'paired',
        ),
      ],
      expect({ responses, check }) {
        checkRefused(check, responses[0], 'from the app');
        checkRefused(check, responses[1], 'from the same origin');
      },
    }),
  ],
});
