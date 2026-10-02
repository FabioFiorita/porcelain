import {
  readServiceUpdateResponseSchema,
  startServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, unauthenticated } from '../kit/answers.ts';
import { eventually, tunnelOn } from '../kit/reads.ts';
import { pairDevice, read, pairBrowser } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const UPDATE_PATH = '/api/service/update';
const status: HttpRequest = { method: 'GET', path: UPDATE_PATH };
const APP = 'http://app.example';
const TUNNEL_HOST = 'porcelain.example.com';
const throughTunnel = { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` };
const untrusted = apiError(
  403,
  'Forbidden',
  'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain',
);
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${APP} cannot write here`,
);

function settled(body: Record<string, unknown>) {
  return body.running === false;
}

function start(
  version: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest {
  return { method: 'POST', path: UPDATE_PATH, body: { version }, ...request };
}

async function setTrust(session: Session, id: string, trusted: boolean) {
  await read(session, {
    method: 'POST',
    path: '/access/trust',
    target: 'owner',
    body: { id, trusted },
  });
}

async function trustedDevice(session: Session, label: string) {
  const device = await pairDevice(session, label);
  await setTrust(session, device.deviceId, true);
  return device;
}

test('the update status tells each caller whether it may start an update', async ({
  session,
}) => {
  const phone = await pairDevice(session, 'Status phone');
  const desktop = await trustedDevice(session, 'Status desktop');

  const responses = [
    await session.send(status),
    await session.send({
      ...status,
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
    await session.send({
      ...status,
      auth: { bearer: phone.credential },
      headers: { origin: APP },
    }),
    await session.send({
      ...status,
      auth: { bearer: desktop.credential },
      headers: { origin: APP },
    }),
  ];

  const [here, relayed, untrustedPhone, trustedDesktop] = responses;
  expect(responses.map((response) => response.status)).toStrictEqual([
    200, 200, 200, 200,
  ]);
  expect(here?.body).toEqual(
    expect.schemaMatching(readServiceUpdateResponseSchema),
  );
  expect(here?.body).toMatchObject({ running: false, canUpdate: true });
  expect(relayed?.body).toMatchObject({ running: false, canUpdate: false });
  expect(untrustedPhone?.body).toMatchObject({
    running: false,
    canUpdate: false,
  });
  expect(trustedDesktop?.body).toMatchObject({
    running: false,
    canUpdate: true,
  });
  expect(trustedDesktop?.headers['access-control-allow-origin']).toBe('*');
});

test('an untrusted device is refused an update from another origin and through a relay and nothing starts', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Phone');
  const before = await read(session, status);

  const bearer = await session.send(
    start(before.latest, {
      auth: { bearer: device.credential },
      headers: { origin: APP },
    }),
  );
  const relayed = await session.send(
    start(before.latest, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  );

  expect(bearer.status).toBe(403);
  expect(bearer.body).toStrictEqual(untrusted);
  expect(relayed.status).toBe(403);
  expect(relayed.body).toStrictEqual(untrusted);
  expect(await read(session, status)).toStrictEqual(before);
});

test('a device the owner stops trusting is refused an update at once and nothing starts', async ({
  session,
}) => {
  const device = await trustedDevice(session, 'Old laptop');
  const before = await read(session, {
    ...status,
    auth: { bearer: device.credential },
    headers: { origin: APP },
  });
  await setTrust(session, device.deviceId, false);

  const response = await session.send(
    start(before.latest, {
      auth: { bearer: device.credential },
      headers: { origin: APP },
    }),
  );

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(untrusted);
  expect(await read(session, status)).toStrictEqual(before);
});

test('a revoked trusted device is refused an update as unauthenticated and nothing starts', async ({
  session,
}) => {
  const issued = await read(session, {
    method: 'POST',
    path: '/pairings',
    target: 'owner',
    body: {
      labels: ['Lost desktop'],
      addresses: [session.address],
      trusted: true,
    },
  });
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: {
      code: text(record(list(issued.grants)[0]).code),
      platform: 'macOS',
    },
  });
  await read(session, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: text(record(paired.device).id) },
  });
  const bearer = text(paired.credential);
  const before = await read(session, status);

  const response = await session.send(
    start(before.latest, {
      auth: { bearer },
      headers: { origin: APP },
    }),
  );

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
  expect(await read(session, status)).toStrictEqual(before);
});

test('a trusted device cannot update with its cookie from another origin and nothing starts', async ({
  session,
}) => {
  const browser = await pairBrowser(session);
  await setTrust(session, browser.deviceId, true);
  const before = await read(session, status);

  const response = await session.send(
    start(before.latest, {
      auth: { cookie: browser.cookie },
      headers: { origin: APP },
    }),
  );

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(refusedFromApp);
  expect(await read(session, status)).toStrictEqual(before);
});

test('a trusted bearer client on another origin starts an update it can read the progress of', async ({
  session,
}) => {
  const device = await trustedDevice(session, 'Desktop app');
  const before = await read(session, status);

  const response = await session.send(
    start(before.latest, {
      auth: { bearer: device.credential },
      headers: { origin: APP },
    }),
  );

  expect(response.status).toBe(202);
  expect(response.body).toEqual(
    expect.schemaMatching(startServiceUpdateResponseSchema),
  );
  expect(response.body).toMatchObject({
    running: true,
    last: {
      from: before.version,
      target: before.latest,
      stage: 'downloading',
    },
    canUpdate: true,
  });
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(await eventually(session, status, settled)).toMatchObject({
    last: { target: before.latest, stage: 'failed' },
  });
});

test('a trusted browser on the web the server serves updates it with its cookie', async ({
  session,
}) => {
  await tunnelOn(session, TUNNEL_HOST);
  const browser = await pairBrowser(session, throughTunnel);
  await setTrust(session, browser.deviceId, true);
  const before = await read(session, status);

  const response = await session.send(
    start(before.latest, {
      auth: { cookie: browser.cookie },
      headers: throughTunnel,
    }),
  );

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    running: true,
    last: { stage: 'downloading' },
  });
  expect(await eventually(session, status, settled)).toMatchObject({
    version: before.latest,
    running: false,
    last: {
      from: before.version,
      target: before.latest,
      stage: 'updated',
    },
  });
});
