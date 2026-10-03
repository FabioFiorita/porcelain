import { listAccessResponseSchema } from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { unauthenticated } from '../kit/answers.ts';
import { tunnelOn } from '../kit/reads.ts';
import { issuePairing } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const TUNNEL_HOST = 'porcelain.example.com';
const throughTunnel = { host: TUNNEL_HOST, origin: `https://${TUNNEL_HOST}` };
const inventoryRead = { method: 'GET', path: '/api/inventory' } as const;

test('the device paired on this computer is refused through the tunnel', async ({
  session,
}) => {
  await tunnelOn(session, TUNNEL_HOST);

  const direct = await session.send(inventoryRead);
  const tunnelled = await session.send({
    ...inventoryRead,
    headers: throughTunnel,
  });

  expect(direct.status).toBe(200);
  expect(direct.body).toEqual(
    expect.schemaMatching(readInventoryResponseSchema),
  );
  expect(tunnelled.status).toBe(401);
  expect(tunnelled.body).toStrictEqual(unauthenticated);
});

test('a device paired through the tunnel works only through the tunnel', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Travel phone');

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: throughTunnel,
    body: { code, platform: 'iOS' },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).device).toMatchObject({
    label: 'Travel phone',
    platform: 'iOS',
  });
  const bearer = text(record(response.body).credential);
  const tunnelRead = await session.send({
    ...inventoryRead,
    auth: { bearer },
    headers: throughTunnel,
  });
  expect(tunnelRead.status).toBe(200);
  expect(tunnelRead.body).toEqual(
    expect.schemaMatching(readInventoryResponseSchema),
  );
  const directRead = await session.send({ ...inventoryRead, auth: { bearer } });
  expect(directRead.status).toBe(401);
  expect(directRead.body).toStrictEqual(unauthenticated);
});

test('the listing names the route each device was paired over', async ({
  session,
}) => {
  const response = await session.send({ method: 'GET', path: '/api/access' });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(listAccessResponseSchema),
  );
  expect(
    list(record(response.body).devices).map((device) => ({
      label: record(device).label,
      route: record(device).route,
    })),
  ).toStrictEqual([
    { label: session.fixture.device.label, route: 'loopback' },
    { label: 'Travel phone', route: 'tunnel' },
  ]);
});
