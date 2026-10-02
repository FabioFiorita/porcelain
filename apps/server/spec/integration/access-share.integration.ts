import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  pairingLinkForm,
  unauthenticated,
} from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { pairDevice, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);

async function access(session: Session) {
  return read(session, { method: 'GET', path: '/api/access' });
}

async function fixtureDeviceId(session: Session) {
  const current = list((await access(session)).devices).find(
    (device) => record(device).current === true,
  );
  return text(record(current).id);
}

test('listing access shows no pending links and marks the asking device as the current one', async ({
  session,
}) => {
  const response = await session.send({ method: 'GET', path: '/api/access' });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(listAccessResponseSchema),
  );
  expect(record(response.body).grants).toStrictEqual([]);
  expect(
    list(record(response.body).devices).map((device) => ({
      label: record(device).label,
      platform: record(device).platform,
      current: record(device).current,
    })),
  ).toStrictEqual([{ ...session.fixture.device, current: true }]);
});

test('issuing a pairing link returns a one-time link to the pairing page that stays pending', async ({
  session,
}) => {
  const response = await session.send({
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Phone'], addresses: [session.address] },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(issuePairingResponseSchema),
  );
  const grant = record(list(record(response.body).grants)[0]);
  expect(grant.grant).toMatchObject({
    label: 'Phone',
    addresses: [session.address],
  });
  expect(grant.link).toMatch(
    pairingLinkForm(
      session.address,
      text((await inventory(session)).environmentId),
    ),
  );
  expect(
    list((await access(session)).grants).map((entry) => record(entry).id),
  ).toStrictEqual([record(grant.grant).id]);
});

test('issuing a pairing link with invalid input or for an address the server does not answer at is refused and issues nothing', async ({
  session,
}) => {
  const before = await access(session);

  const invalid = await session.send({
    method: 'POST',
    path: '/api/pairings',
    body: { labels: [], addresses: [] },
  });
  const unreachable = await session.send({
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Phone'], addresses: ['http://203.0.113.5:4173'] },
  });

  expect(invalid.status).toBe(400);
  expect(invalid.body).toStrictEqual(invalidRequest);
  expect(unreachable.status).toBe(400);
  expect(unreachable.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'This server does not answer at that address, so a link aimed there would not reach it.',
    ),
  );
  expect(await access(session)).toStrictEqual(before);
});

test('revoking a pending link removes it and revoking an unknown id revokes nothing', async ({
  session,
}) => {
  const before = (await access(session)).grants;
  const issued = await read(session, {
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Tablet'], addresses: [session.address] },
  });
  const grantId = text(record(record(list(issued.grants)[0]).grant).id);

  const revoked = await session.send({
    method: 'POST',
    path: '/api/access/revoke',
    body: { id: grantId },
  });
  const unknown = await session.send({
    method: 'POST',
    path: '/api/access/revoke',
    body: { id: 'unknown' },
  });

  expect(revoked.status).toBe(200);
  expect(revoked.body).toEqual(
    expect.schemaMatching(revokeAccessResponseSchema),
  );
  expect(revoked.body).toStrictEqual({ revoked: true, kind: 'grant' });
  expect(unknown.status).toBe(200);
  expect(unknown.body).toStrictEqual({ revoked: false });
  expect((await access(session)).grants).toStrictEqual(before);
});

test('a relayed or remote request to list, issue or revoke access is refused and changes nothing', async ({
  session,
}) => {
  const before = await access(session);

  const responses = [
    await session.send({
      method: 'GET',
      path: '/api/access',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
    await session.send({
      method: 'POST',
      path: '/api/pairings',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
      body: { labels: ['Intruder'], addresses: [session.address] },
    }),
    await session.send({
      method: 'POST',
      path: '/api/access/revoke',
      headers: { forwarded: 'for=203.0.113.9' },
      body: { id: 'unknown' },
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual(notOnThisComputer);
  }
  expect(await access(session)).toStrictEqual(before);
});

test('revoking a device closes its live connection, refuses its next request and removes it from the list', async ({
  session,
}) => {
  const connection = await session.live();
  await connection.next((notice) => notice.type === 'ready');
  const other = await pairDevice(session, 'Laptop');
  const revokedId = await fixtureDeviceId(session);

  const revoked = await session.send({
    method: 'POST',
    path: '/api/access/revoke',
    auth: { bearer: other.credential },
    body: { id: revokedId },
  });
  const next = await session.send({ method: 'GET', path: '/api/inventory' });

  expect(revoked.status).toBe(200);
  expect(revoked.body).toStrictEqual({ revoked: true, kind: 'device' });
  expect(await connection.closed()).toStrictEqual({
    code: 4001,
    reason: 'Device access revoked',
  });
  expect(next.status).toBe(401);
  expect(next.body).toStrictEqual(unauthenticated);
  const remaining = await read(session, {
    method: 'GET',
    path: '/api/access',
    auth: { bearer: other.credential },
  });
  expect(
    list(remaining.devices).map((device) => record(device).label),
  ).toStrictEqual(['Laptop']);
});
