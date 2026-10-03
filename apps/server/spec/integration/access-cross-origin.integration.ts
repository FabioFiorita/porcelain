import {
  listAccessResponseSchema,
  readEnvironmentResponseSchema,
  readHealthResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, credentialForm, unauthenticated } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import {
  issuePairing,
  owner,
  pairBrowser,
  pairDevice,
  read,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const APP = 'http://app.example';
const fromApp = { origin: APP };
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${APP} cannot write here`,
);
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const projectPath = (session: Session) => `/api/projects/${session.projectId}`;
const rename = (
  session: Session,
  name: string,
  request: {
    headers?: Record<string, string>;
    auth?: 'none' | { bearer: string } | { cookie: string };
  },
) => ({
  method: 'PATCH' as const,
  path: projectPath(session),
  body: { name },
  ...request,
});
const projectName = async (session: Session) =>
  record(list((await inventory(session)).projects)[0]).name;

test('a preflight from another origin is answered before any origin or credential check', async ({
  session,
}) => {
  const response = await session.send({
    method: 'OPTIONS',
    path: projectPath(session),
    auth: 'none',
    headers: {
      origin: APP,
      'access-control-request-method': 'PATCH',
      'access-control-request-headers': 'authorization, content-type',
    },
  });

  expect(response.status).toBe(204);
  expect(response.body).toBeUndefined();
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(response.headers['access-control-allow-methods']).toBe(
    'GET, HEAD, POST, PUT, PATCH, DELETE',
  );
  expect(response.headers['access-control-allow-headers']).toBe(
    'authorization, content-type',
  );
  expect(response.headers['access-control-max-age']).toBe('600');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
});

test('a page on another origin cannot read the public environment or health, while a bearer client can', async ({
  session,
}) => {
  const anonymous = await session.send({
    method: 'GET',
    path: '/api/environment',
    headers: fromApp,
    auth: 'none',
  });
  const health = await session.send({
    method: 'GET',
    path: '/api/health',
    headers: fromApp,
    auth: 'none',
  });
  const bearer = await session.send({
    method: 'GET',
    path: '/api/environment',
    headers: fromApp,
  });
  const preflight = await session.send({
    method: 'OPTIONS',
    path: '/api/environment',
    auth: 'none',
    headers: { origin: APP, 'access-control-request-method': 'GET' },
  });

  expect(anonymous.status).toBe(200);
  expect(anonymous.body).toEqual(
    expect.schemaMatching(readEnvironmentResponseSchema),
  );
  expect(anonymous.headers['access-control-allow-origin']).toBeUndefined();
  expect(health.status).toBe(200);
  expect(health.body).toEqual(expect.schemaMatching(readHealthResponseSchema));
  expect(health.headers['access-control-allow-origin']).toBeUndefined();
  expect(bearer.status).toBe(200);
  expect(bearer.body).toStrictEqual(anonymous.body);
  expect(bearer.headers['access-control-allow-origin']).toBe('*');
  expect(preflight.status).toBe(404);
  expect(preflight.body).toStrictEqual(
    apiError(404, 'Not Found', 'Route OPTIONS:/api/environment not found'),
  );
  expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
});

test('a pairing redemption may be preflighted from another origin without allowing credentials', async ({
  session,
}) => {
  const response = await session.send({
    method: 'OPTIONS',
    path: '/api/pair',
    auth: 'none',
    headers: {
      origin: APP,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });

  expect(response.status).toBe(204);
  expect(response.body).toBeUndefined();
  expect(response.headers['access-control-allow-origin']).toBe('*');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
});

test('a bearer client on another origin, or on an opaque one, reads and writes', async ({
  session,
}) => {
  const before = await inventory(session);

  const listed = await session.send({
    method: 'GET',
    path: '/api/inventory',
    headers: fromApp,
  });
  const renamed = await session.send(
    rename(session, 'From the app', { headers: fromApp }),
  );
  const opaque = await session.send(
    rename(session, 'From a file page', { headers: { origin: 'null' } }),
  );

  expect(listed.status).toBe(200);
  expect(listed.body).toStrictEqual(before);
  expect(listed.headers['access-control-allow-origin']).toBe('*');
  expect(listed.headers['access-control-allow-credentials']).toBeUndefined();
  expect(renamed.status).toBe(200);
  expect(renamed.body).toStrictEqual({
    id: session.projectId,
    name: 'From the app',
  });
  expect(opaque.status).toBe(200);
  expect(opaque.body).toStrictEqual({
    id: session.projectId,
    name: 'From a file page',
  });
  expect(await projectName(session)).toBe('From a file page');
});

test('a bearer client on another origin reads whose session it holds until its device is revoked', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Status check');
  const readSession = () =>
    session.send({
      method: 'GET',
      path: '/api/session',
      headers: fromApp,
      auth: { bearer: device.credential },
    });

  const paired = await readSession();
  await read(
    session,
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: device.deviceId },
    }),
  );
  const revoked = await readSession();

  expect(paired.status).toBe(200);
  expect(paired.body).toStrictEqual({
    kind: 'device',
    deviceId: device.deviceId,
  });
  expect(paired.headers['access-control-allow-origin']).toBe('*');
  expect(revoked.status).toBe(401);
  expect(revoked.body).toStrictEqual(unauthenticated);
  expect(revoked.headers['access-control-allow-origin']).toBe('*');
});

test('a cookie, no credential or an unknown bearer cannot write from another origin', async ({
  session,
}) => {
  const { cookie } = await pairBrowser(session);
  const name = await projectName(session);

  const withCookie = await session.send(
    rename(session, 'Cookie', { headers: fromApp, auth: { cookie } }),
  );
  const nobody = await session.send(
    rename(session, 'Nobody', { headers: fromApp, auth: 'none' }),
  );
  const unknown = await session.send(
    rename(session, 'Unknown', {
      headers: fromApp,
      auth: { bearer: 'pcd_not-a-device' },
    }),
  );

  expect(withCookie.status).toBe(403);
  expect(withCookie.body).toStrictEqual(refusedFromApp);
  expect(nobody.status).toBe(403);
  expect(nobody.body).toStrictEqual(refusedFromApp);
  expect(unknown.status).toBe(401);
  expect(unknown.body).toStrictEqual(unauthenticated);
  expect(await projectName(session)).toBe(name);
});

test('an empty or unknown bearer beside a valid cookie never authenticates by the cookie', async ({
  session,
}) => {
  const { cookie } = await pairBrowser(session);
  const name = await projectName(session);

  const empty = await session.send(
    rename(session, 'Empty bearer', {
      headers: { ...fromApp, authorization: 'Bearer ' },
      auth: { cookie },
    }),
  );
  const unknown = await session.send(
    rename(session, 'Unknown bearer', {
      headers: { ...fromApp, authorization: 'Bearer pcd_not-a-device' },
      auth: { cookie },
    }),
  );
  const here = await session.send(
    rename(session, 'Unknown bearer here', {
      headers: { authorization: 'Bearer pcd_not-a-device' },
      auth: { cookie },
    }),
  );

  expect(empty.status).toBe(403);
  expect(empty.body).toStrictEqual(refusedFromApp);
  expect(unknown.status).toBe(401);
  expect(unknown.body).toStrictEqual(unauthenticated);
  expect(here.status).toBe(401);
  expect(here.body).toStrictEqual(unauthenticated);
  expect(await projectName(session)).toBe(name);
});

test('a bearer client from a host the server does not answer to is refused and changes nothing', async ({
  session,
}) => {
  const name = await projectName(session);

  const response = await session.send(
    rename(session, 'Rebound', {
      headers: { host: 'rebound.example', origin: 'http://rebound.example' },
    }),
  );

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      'This server does not answer to the host rebound.example',
    ),
  );
  expect(await projectName(session)).toBe(name);
});

test('a pairing code is redeemed from another origin without a cookie, bound to the route it reached', async ({
  session,
}) => {
  const ownerBefore = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  const code = await issuePairing(session, 'Desktop app');
  const route = record(list(ownerBefore.devices)[0]).route;

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: { ...fromApp, 'x-porcelain-browser': '1' },
    body: { code, platform: 'macOS' },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(redeemPairingResponseSchema),
  );
  const body = record(response.body);
  expect(body.device).toMatchObject({
    label: 'Desktop app',
    platform: 'macOS',
  });
  expect(body.credential).toMatch(credentialForm);
  expect(response.headers['set-cookie']).toBeUndefined();
  expect(response.headers['access-control-allow-origin']).toBe('*');
  const reading = await session.send({
    method: 'GET',
    path: '/api/inventory',
    headers: fromApp,
    auth: { bearer: text(body.credential) },
  });
  expect(reading.status).toBe(200);
  const owner = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  expect(owner).toEqual(expect.schemaMatching(listAccessResponseSchema));
  expect(
    list(owner.devices).filter(
      (device) => record(device).id === record(body.device).id,
    ),
  ).toMatchObject([{ label: 'Desktop app', route }]);
});

test('sharing stays with the host browser and a bearer client on another origin changes nothing', async ({
  session,
}) => {
  const before = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });

  const listed = await session.send({
    method: 'GET',
    path: '/api/access',
    headers: fromApp,
  });
  const revoked = await session.send({
    method: 'POST',
    path: '/api/access/revoke',
    headers: fromApp,
    body: { id: 'unknown' },
  });

  expect(listed.status).toBe(403);
  expect(listed.body).toStrictEqual(notOnThisComputer);
  expect(revoked.status).toBe(403);
  expect(revoked.body).toStrictEqual(refusedFromApp);
  expect(
    await read(session, { method: 'GET', path: '/access', target: 'owner' }),
  ).toStrictEqual(before);
});
