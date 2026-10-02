import {
  listAccessResponseSchema,
  setDeviceTrustResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { tunnelOn } from '../kit/reads.ts';
import { issuePairing, pairDevice, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type HttpRequest } from '../kit/session.ts';

const TUNNEL_HOST = 'porcelain.example.com';
const throughTunnel = { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` };
const APP = 'http://app.example';
const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const refusedFromApp = apiError(
  403,
  'Forbidden',
  `The origin ${APP} cannot write here`,
);
const notFound = apiError(404, 'Not Found', 'Device not found');
const accessRead = { method: 'GET', path: '/api/access' } as const;
const ownerAccess = {
  method: 'GET',
  path: '/access',
  target: 'owner',
} as const;
const trust = (
  id: string,
  trusted: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest => ({
  method: 'POST',
  path: '/api/access/trust',
  body: { id, trusted },
  ...request,
});

function deviceTrust(listing: Record<string, unknown>, id: string) {
  const device = record(
    list(listing.devices).find((entry) => record(entry).id === id),
  );
  return { label: device.label, trusted: device.trusted };
}

test('a paired device is untrusted until the owner trusts it, and untrusted again when the owner stops', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Desktop');

  const before = await session.send(accessRead);
  const trusted = await session.send(trust(device.deviceId, true));
  const untrusted = await session.send(trust(device.deviceId, false));

  expect(before.status).toBe(200);
  expect(before.body).toEqual(expect.schemaMatching(listAccessResponseSchema));
  expect(deviceTrust(record(before.body), device.deviceId)).toStrictEqual({
    label: 'Desktop',
    trusted: false,
  });
  expect(trusted.status).toBe(200);
  expect(trusted.body).toEqual(
    expect.schemaMatching(setDeviceTrustResponseSchema),
  );
  expect(trusted.body).toStrictEqual({ id: device.deviceId, trusted: true });
  expect(untrusted.status).toBe(200);
  expect(untrusted.body).toStrictEqual({
    id: device.deviceId,
    trusted: false,
  });
  expect(
    deviceTrust(await read(session, accessRead), device.deviceId),
  ).toStrictEqual({ label: 'Desktop', trusted: false });
});

test('the listing says which paired devices are trusted', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Trusted desktop');
  await read(session, trust(device.deviceId, true));

  const response = await session.send(accessRead);

  expect(response.status).toBe(200);
  expect(
    list(record(response.body).devices).map((entry) => ({
      label: record(entry).label,
      trusted: record(entry).trusted,
    })),
  ).toStrictEqual([
    { label: session.fixture.device.label, trusted: false },
    { label: 'Desktop', trusted: false },
    { label: 'Trusted desktop', trusted: true },
  ]);
});

test('trusting an unknown or revoked device is not found, a malformed request is refused, and nothing changes', async ({
  session,
}) => {
  const revoked = await pairDevice(session, 'Lost phone');
  await read(session, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: revoked.deviceId },
  });
  const before = await read(session, ownerAccess);
  const responses = [];

  for (const request of [
    trust('00000000-0000-4000-8000-000000000000', true),
    trust(revoked.deviceId, true),
    trust(revoked.deviceId, 'yes'),
    { method: 'POST' as const, path: '/api/access/trust', body: { id: '' } },
  ])
    responses.push(await session.send(request));

  expect(responses.map((response) => response.status)).toStrictEqual([
    404, 404, 400, 400,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    notFound,
    notFound,
    invalidRequest,
    invalidRequest,
  ]);
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});

test('a relayed request, a trusted device through the tunnel and a bearer client on another origin cannot change trust', async ({
  session,
}) => {
  await tunnelOn(session, TUNNEL_HOST);
  const code = await issuePairing(session, 'Travel laptop');
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: throughTunnel,
    body: { code, platform: 'macOS' },
  });
  const deviceId = text(record(paired.device).id);
  await read(session, {
    method: 'POST',
    path: '/access/trust',
    target: 'owner',
    body: { id: deviceId, trusted: true },
  });
  const other = await pairDevice(session, 'Phone');
  const bearer = text(paired.credential);
  const before = await read(session, ownerAccess);

  const relayed = await session.send(
    trust(other.deviceId, true, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  );
  const tunnel = await session.send(
    trust(other.deviceId, true, { auth: { bearer }, headers: throughTunnel }),
  );
  const tunnelListing = await session.send({
    ...accessRead,
    auth: { bearer },
    headers: throughTunnel,
  });
  const crossOrigin = await session.send(
    trust(other.deviceId, true, { headers: { origin: APP } }),
  );

  expect(relayed.status).toBe(403);
  expect(relayed.body).toStrictEqual(notOnThisComputer);
  expect(tunnel.status).toBe(403);
  expect(tunnel.body).toStrictEqual(notOnThisComputer);
  expect(tunnelListing.status).toBe(403);
  expect(tunnelListing.body).toStrictEqual(notOnThisComputer);
  expect(crossOrigin.status).toBe(403);
  expect(crossOrigin.body).toStrictEqual(refusedFromApp);
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});
