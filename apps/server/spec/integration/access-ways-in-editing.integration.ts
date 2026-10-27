import * as Schema from 'effect/Schema';
import {
  listAccessResponseSchema,
  readRemoteAccessResponseSchema,
  setWaysInPermissionResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest, unauthenticated } from '../kit/answers.ts';
import { tunnelOn } from '../kit/reads.ts';
import {
  issuePairing,
  pairBrowser,
  pairDevice,
  read,
  waysInChange,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const TUNNEL_HOST = 'porcelain.example.com';
const throughTunnel = { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` };
const APP = 'http://app.example';
const permissionRequired = apiError(
  403,
  'Forbidden',
  'An owner must let this device edit ways in on the computer that runs Porcelain before it can see or change them',
);
const routeInUse = apiError(
  409,
  'Conflict',
  'This device is connected through this way in, so it cannot change it. Change it on the computer that runs Porcelain, or from a device connected another way.',
);
const changedSince = apiError(
  409,
  'Conflict',
  'The ways in changed since you last looked. Check them again, then save your change.',
);
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const notFound = apiError(404, 'Not Found', 'Device not found');
const ownerWaysIn = {
  method: 'GET',
  path: '/remote-access',
  target: 'owner',
} as const;
const ownerAccess = {
  method: 'GET',
  path: '/access',
  target: 'owner',
} as const;

function permission(
  id: string,
  allowed: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest {
  return {
    method: 'POST',
    path: '/api/access/ways-in-permission',
    body: { id, allowed },
    ...request,
  };
}

async function pairThroughTunnel(session: Session, label: string) {
  await tunnelOn(session, TUNNEL_HOST);
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: throughTunnel,
    body: { code: await issuePairing(session, label), platform: 'iOS' },
  });
  const bearer = text(paired.credential);
  return {
    deviceId: text(record(paired.device).id),
    tunnel: { auth: { bearer }, headers: throughTunnel },
  };
}

function waysInPermission(listing: Record<string, unknown>, id: string) {
  return record(list(listing.devices).find((entry) => record(entry).id === id))
    .canEditWaysIn;
}

test('a device the owner has not let edit ways in sees no ways in and cannot change them, trusted or not', async ({
  session,
}) => {
  const { deviceId, tunnel } = await pairThroughTunnel(session, 'Phone');
  const before = await read(session, ownerWaysIn);
  const forged = {
    expected: record(before.editing).fingerprint,
    change: { lan: true },
  };
  const responses = [];

  for (const trusted of [false, true]) {
    await read(session, {
      method: 'POST',
      path: '/api/access/trust',
      body: { id: deviceId, trusted },
    });
    responses.push(
      await session.send({
        ...tunnel,
        method: 'GET',
        path: '/api/remote-access',
      }),
      await session.send({
        ...tunnel,
        method: 'PATCH',
        path: '/api/remote-access',
        body: forged,
      }),
    );
  }

  expect(
    responses.map((response) => ({
      status: response.status,
      body: response.body,
    })),
  ).toStrictEqual(
    Array.from({ length: 4 }, () => ({
      status: 403,
      body: permissionRequired,
    })),
  );
  expect(waysInPermission(await read(session, ownerAccess), deviceId)).toBe(
    false,
  );
  expect(await read(session, ownerWaysIn)).toStrictEqual(before);
});

test('a device the owner lets edit ways in changes another way in through the tunnel, and the listing says so', async ({
  session,
}) => {
  const { deviceId, tunnel } = await pairThroughTunnel(session, 'Tablet');

  const granted = await session.send(permission(deviceId, true));
  const listing = await read(session, { method: 'GET', path: '/api/access' });
  const editor = await session.send({
    ...tunnel,
    method: 'GET',
    path: '/api/remote-access',
  });
  const saved = await session.send(
    await waysInChange(session, { lan: true }, tunnel),
  );

  expect(granted.status).toBe(200);
  expect(granted.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(setWaysInPermissionResponseSchema),
      ),
    ),
  );
  expect(granted.body).toStrictEqual({ id: deviceId, allowed: true });
  expect(listing).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(waysInPermission(listing, deviceId)).toBe(true);
  expect(
    list(listing.devices)
      .filter((entry) => record(entry).id !== deviceId)
      .every((entry) => record(entry).canEditWaysIn === false),
  ).toBe(true);
  expect(editor.status).toBe(200);
  expect(editor.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readRemoteAccessResponseSchema),
      ),
    ),
  );
  expect(record(record(editor.body).editing).protectedRoute).toBe('cloudflare');
  expect(saved.status).toBe(200);
  expect(record(record(saved.body).routes).lan).toStrictEqual({
    enabled: true,
    status: { kind: 'starting' },
  });
  expect(record(record(saved.body).editing).protectedRoute).toBe('cloudflare');
  expect(
    record(record((await read(session, ownerWaysIn)).routes).lan).enabled,
  ).toBe(true);
});

test('a device editing through the tunnel cannot turn off or rename the tunnel it is connected through', async ({
  session,
}) => {
  const { deviceId, tunnel } = await pairThroughTunnel(session, 'Laptop');
  await read(session, permission(deviceId, true));
  const before = await read(session, ownerWaysIn);
  const responses = [];

  for (const change of [
    { cloudflare: false },
    { cloudflare: true },
    { cloudflareHostname: 'other.example.com' },
    { lan: true, cloudflare: false },
  ])
    responses.push(
      await session.send(await waysInChange(session, change, tunnel)),
    );

  expect(
    responses.map((response) => ({
      status: response.status,
      body: response.body,
    })),
  ).toStrictEqual(
    Array.from({ length: 4 }, () => ({ status: 409, body: routeInUse })),
  );
  expect(await read(session, ownerWaysIn)).toStrictEqual(before);
});

test('a save made from an older look at the ways in is refused, and a fresh look saves it', async ({
  session,
}) => {
  const stale = await waysInChange(session, { lan: true });
  await read(
    session,
    await waysInChange(session, {
      tailnet: true,
      tailnetHostname: 'porcelain.tail0000.ts.net',
    }),
  );
  const before = await read(session, ownerWaysIn);

  const refused = await session.send(stale);
  const unchanged = await read(session, ownerWaysIn);
  const fresh = await session.send(await waysInChange(session, { lan: true }));

  expect(refused.status).toBe(409);
  expect(refused.body).toStrictEqual(changedSince);
  expect(unchanged).toStrictEqual(before);
  expect(fresh.status).toBe(200);
  expect(record(record(fresh.body).routes).lan).toStrictEqual({
    enabled: true,
    status: { kind: 'starting' },
  });
});

test('a revoked device loses the ways in at once, and a removed permission refuses the next look', async ({
  session,
}) => {
  const revoked = await pairThroughTunnel(session, 'Lost phone');
  const kept = await pairThroughTunnel(session, 'Kept phone');
  await read(session, permission(revoked.deviceId, true));
  await read(session, permission(kept.deviceId, true));
  const look = { method: 'GET', path: '/api/remote-access' } as const;
  const lookedBefore = await session.send({ ...kept.tunnel, ...look });

  await read(session, {
    method: 'POST',
    path: '/api/access/revoke',
    body: { id: revoked.deviceId },
  });
  await read(session, permission(kept.deviceId, false));
  const afterRevoke = await session.send({ ...revoked.tunnel, ...look });
  const afterRemoval = await session.send({ ...kept.tunnel, ...look });

  expect(lookedBefore.status).toBe(200);
  expect(afterRevoke.status).toBe(401);
  expect(afterRevoke.body).toStrictEqual(unauthenticated);
  expect(afterRemoval.status).toBe(403);
  expect(afterRemoval.body).toStrictEqual(permissionRequired);
});

test('only the computer that runs Porcelain grants the permission: a device cannot grant itself, and relayed or other-page requests change nothing', async ({
  session,
}) => {
  const { deviceId, tunnel } = await pairThroughTunnel(session, 'Phone');
  await read(session, permission(deviceId, true));
  await read(session, {
    method: 'POST',
    path: '/api/access/trust',
    body: { id: deviceId, trusted: true },
  });
  const other = await pairDevice(session, 'Desktop');
  const before = await read(session, ownerAccess);

  const selfGrant = await session.send(
    permission(other.deviceId, true, tunnel),
  );
  const relayed = await session.send(
    permission(other.deviceId, true, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  );
  const crossOrigin = await session.send(
    permission(other.deviceId, true, { headers: { origin: APP } }),
  );

  expect(selfGrant.status).toBe(403);
  expect(selfGrant.body).toStrictEqual(notOnThisComputer);
  expect(relayed.status).toBe(403);
  expect(relayed.body).toStrictEqual(notOnThisComputer);
  expect(crossOrigin.status).toBe(403);
  expect(crossOrigin.body).toStrictEqual(
    apiError(403, 'Forbidden', `The origin ${APP} cannot write here`),
  );
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});

test('granting the permission to an unknown or revoked device is not found, a malformed request is refused, and nothing changes', async ({
  session,
}) => {
  const revoked = await pairDevice(session, 'Old phone');
  await read(session, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: revoked.deviceId },
  });
  const before = await read(session, ownerAccess);
  const responses = [];

  for (const request of [
    permission('00000000-0000-4000-8000-000000000000', true),
    permission(revoked.deviceId, true),
    permission(revoked.deviceId, 'yes'),
    {
      method: 'POST' as const,
      path: '/api/access/ways-in-permission',
      body: { id: '' },
    },
  ])
    responses.push(await session.send(request));

  expect(
    responses.map((response) => ({
      status: response.status,
      body: response.body,
    })),
  ).toStrictEqual([
    { status: 404, body: notFound },
    { status: 404, body: notFound },
    { status: 400, body: invalidRequest },
    { status: 400, body: invalidRequest },
  ]);
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});

test('the owner socket grants the permission and edits every way in, a browser on another page cannot write the ways in with its cookie', async ({
  session,
}) => {
  const { deviceId } = await pairThroughTunnel(session, 'Watch');

  const granted = await session.send({
    method: 'POST',
    path: '/access/ways-in-permission',
    target: 'owner',
    body: { id: deviceId, allowed: true },
  });
  const current = await read(session, ownerWaysIn);
  const ownerSaved = await session.send({
    method: 'PATCH',
    path: '/remote-access',
    target: 'owner',
    body: {
      expected: record(current.editing).fingerprint,
      change: { cloudflare: false, lan: true },
    },
  });
  const { cookie } = await pairBrowser(session);
  const crossOrigin = await session.send({
    ...(await waysInChange(session, { lan: false })),
    auth: { cookie },
    headers: { origin: APP },
  });

  expect(granted.status).toBe(200);
  expect(granted.body).toStrictEqual({ id: deviceId, allowed: true });
  expect(ownerSaved.status).toBe(200);
  expect(record(ownerSaved.body).routes).toMatchObject({
    lan: { enabled: true },
    cloudflare: { enabled: false },
  });
  expect(crossOrigin.status).toBe(403);
  expect(crossOrigin.body).toStrictEqual(
    apiError(403, 'Forbidden', `The origin ${APP} cannot write here`),
  );
});
