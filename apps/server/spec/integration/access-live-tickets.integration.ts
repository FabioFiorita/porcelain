import { setTimeout as delay } from 'node:timers/promises';
import {
  issueLiveTicketResponseSchema,
  liveNoticeSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import {
  apiError,
  liveTicketForm,
  unauthenticated,
  upgradeHeaders,
} from '../kit/answers.ts';
import { pairDevice, read, pairBrowser } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  record,
  text,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const APP = 'http://app.example';
const TICKETS = '/api/live/tickets';

async function ticketFor(session: Session, credential?: string) {
  const issued = await read(session, {
    method: 'POST',
    path: TICKETS,
    headers: { origin: APP },
    ...(credential === undefined ? {} : { auth: { bearer: credential } }),
  });
  return { ticket: text(issued.ticket), expiresAt: text(issued.expiresAt) };
}

function upgradeWith(
  session: Session,
  ticket: string,
  origin: string | undefined = APP,
  auth: HttpRequest['auth'] = 'none',
): HttpRequest {
  const headers = Object.fromEntries(
    Object.entries(upgradeHeaders(session.address)).filter(
      ([name]) => name !== 'origin',
    ),
  );
  return {
    method: 'GET',
    path: '/api/live',
    query: { ticket },
    auth,
    headers: origin === undefined ? headers : { ...headers, origin },
  };
}

function answer(response: { status: number; body: unknown }) {
  return { status: response.status, body: response.body };
}

const refused = { status: 401, body: unauthenticated };

test('a paired device on another origin gets a live ticket and nobody else does', async ({
  session,
}) => {
  const issued = await session.send({
    method: 'POST',
    path: TICKETS,
    headers: { origin: APP },
  });
  const crossOrigin = await session.send({
    method: 'POST',
    path: TICKETS,
    headers: { origin: APP },
    auth: 'none',
  });
  const anonymous = await session.send({
    method: 'POST',
    path: TICKETS,
    auth: 'none',
  });

  expect(issued.status).toBe(200);
  expect(issued.body).toEqual(
    expect.schemaMatching(issueLiveTicketResponseSchema),
  );
  expect(record(issued.body).ticket).toMatch(liveTicketForm);
  expect(record(issued.body).expiresAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  expect(issued.headers['access-control-allow-origin']).toBe('*');
  expect(crossOrigin.status).toBe(403);
  expect(crossOrigin.body).toStrictEqual(
    apiError(403, 'Forbidden', `The origin ${APP} cannot write here`),
  );
  expect(anonymous.status).toBe(401);
  expect(anonymous.body).toStrictEqual(unauthenticated);
});

test('a ticket opens live updates from another origin that hear changes and close when the device is revoked', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Desktop app');
  const { ticket } = await ticketFor(session, device.credential);
  const connection = await session.live({ ticket, origin: APP });
  const ready = await connection.next((notice) => notice.type === 'ready');
  connection.send({
    type: 'subscribe',
    projects: [session.projectId],
    worktrees: [],
  });
  await delay(300);

  const renamed = await session.send({
    method: 'PATCH',
    path: `/api/projects/${session.projectId}`,
    body: { name: 'Announced' },
  });
  const revoked = await session.send({
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: device.deviceId },
  });

  expect(ready).toStrictEqual({ type: 'ready' });
  expect(renamed.status).toBe(200);
  expect(renamed.body).toStrictEqual({
    id: session.projectId,
    name: 'Announced',
  });
  const notice = await connection.next((entry) => entry.type === 'inventory');
  expect(notice).toStrictEqual({ type: 'inventory' });
  expect(notice).toEqual(expect.schemaMatching(liveNoticeSchema));
  expect(revoked.status).toBe(200);
  expect(revoked.body).toStrictEqual({ revoked: true, kind: 'device' });
  expect(await connection.closed()).toStrictEqual({
    code: 4001,
    reason: 'Device access revoked',
  });
});

test('a ticket upgrade needs no origin, as a native client sends it', async ({
  session,
}) => {
  const { ticket } = await ticketFor(session);

  const response = await session.send(upgradeWith(session, ticket, undefined));

  expect(response.status).toBe(101);
  expect(response.body).toBeUndefined();
});

test('a ticket works once', async ({ session }) => {
  const { ticket } = await ticketFor(session);
  const connection = await session.live({ ticket, origin: APP });
  await connection.next((notice) => notice.type === 'ready');

  const fromApp = await session.send(upgradeWith(session, ticket));
  const withoutOrigin = await session.send(
    upgradeWith(session, ticket, undefined),
  );

  expect(answer(fromApp)).toStrictEqual(refused);
  expect(answer(withoutOrigin)).toStrictEqual(refused);
});

test('a ticket expires', async ({ session }) => {
  const { ticket } = await ticketFor(session);
  await delay(session.fixture.liveTicketLifetimeMs + 100);

  const response = await session.send(upgradeWith(session, ticket));

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
});

test('the ticket of a revoked device is refused', async ({ session }) => {
  const device = await pairDevice(session, 'Revoked app');
  const { ticket } = await ticketFor(session, device.credential);
  await read(session, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: device.deviceId },
  });

  const response = await session.send(upgradeWith(session, ticket));

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
});

test('a ticket that was never issued, or an empty one, is refused without falling back to the device cookie', async ({
  session,
}) => {
  const { cookie } = await pairBrowser(session);
  const sameOrigin = new URL(session.address).origin;

  const fromSameOrigin = await session.send(
    upgradeWith(session, 'pct_not-a-ticket', sameOrigin, { cookie }),
  );
  const empty = await session.send(
    upgradeWith(session, '', sameOrigin, { cookie }),
  );
  const fromApp = await session.send(
    upgradeWith(session, 'pct_not-a-ticket', APP, { cookie }),
  );

  expect(answer(fromSameOrigin)).toStrictEqual(refused);
  expect(answer(empty)).toStrictEqual(refused);
  expect(answer(fromApp)).toStrictEqual(refused);
});

test('a ticket that was never issued is refused without falling back to the bearer credential', async ({
  session,
}) => {
  const fromApp = await session.send(
    upgradeWith(session, 'pct_not-a-ticket', APP, 'paired'),
  );
  const fromSameOrigin = await session.send(
    upgradeWith(
      session,
      'pct_not-a-ticket',
      new URL(session.address).origin,
      'paired',
    ),
  );

  expect(answer(fromApp)).toStrictEqual(refused);
  expect(answer(fromSameOrigin)).toStrictEqual(refused);
});
