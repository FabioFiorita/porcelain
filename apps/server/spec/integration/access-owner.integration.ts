import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  readOwnerStatusResponseSchema,
} from '@porcelain/contracts/access';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  pairingLinkForm,
  unauthenticated,
} from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { owner, pairDevice, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const ownerAccess = owner({ method: 'GET', path: '/access' });

test('the owner socket reports where the server runs and is never cached', async ({
  session,
}) => {
  const response = await session.send(
    owner({ method: 'GET', path: '/status' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readOwnerStatusResponseSchema),
      ),
    ),
  );
  expect(record(response.body).address).toBe(session.address);
  expect(response.headers['cache-control']).toBe('no-store');
});

test('the owner lists no open pairing grants and the paired fixture device', async ({
  session,
}) => {
  const response = await session.send(ownerAccess);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(record(response.body).grants).toStrictEqual([]);
  expect(
    list(record(response.body).devices).map((device) => ({
      label: record(device).label,
      platform: record(device).platform,
    })),
  ).toStrictEqual([session.fixture.device]);
});

test('the owner issues a pairing whose link opens the Porcelain app link and which is then listed', async ({
  session,
}) => {
  const response = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Tablet'], addresses: [session.address] },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(issuePairingResponseSchema)),
    ),
  );
  const grant = record(list(record(response.body).grants)[0]);
  expect(grant.grant).toMatchObject({
    label: 'Tablet',
    addresses: [session.address],
  });
  expect(grant.link).toMatch(
    pairingLinkForm(
      session.address,
      text((await inventory(session)).environmentId),
    ),
  );
  const access = await read(session, ownerAccess);
  expect(access).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(list(access.grants).map((entry) => record(entry).id)).toStrictEqual([
    record(grant.grant).id,
  ]);
});

test('issuing a pairing for an address the server does not answer at, or with a blank label, issues nothing', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);

  const unreachable = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Tablet'],
        addresses: [session.address, 'http://192.0.2.1:9'],
      },
    }),
  );
  const blank = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Tablet', ' \t '], addresses: [session.address] },
    }),
  );

  expect(unreachable.status).toBe(400);
  expect(unreachable.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'This server does not answer at that address, so a link aimed there would not reach it.',
    ),
  );
  expect(blank.status).toBe(400);
  expect(blank.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'The device name or platform is missing, too long, or contains control characters.',
    ),
  );
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});

test('revoking a device stops its credential working while other devices keep access', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Revoked device');

  const response = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: device.deviceId },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ revoked: true, kind: 'device' });
  const reading = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { bearer: device.credential },
  });
  expect(reading.status).toBe(401);
  expect(reading.body).toStrictEqual(unauthenticated);
  const kept = await session.send({ method: 'GET', path: '/api/inventory' });
  expect(kept.status).toBe(200);
});

test('revoking an unused pairing grant removes it from the listing', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);
  const issued = await read(
    session,
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Unused'], addresses: [session.address] },
    }),
  );
  const grantId = text(record(record(list(issued.grants)[0]).grant).id);

  const response = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: grantId },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ revoked: true, kind: 'grant' });
  const access = await read(session, ownerAccess);
  expect(access.grants).toStrictEqual(before.grants);
});

test('revoking an unknown id revokes nothing and an empty id is refused', async ({
  session,
}) => {
  const unknown = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: 'unknown' },
    }),
  );
  const invalid = await session.send(
    owner({ method: 'POST', path: '/access/revoke', body: { id: '' } }),
  );

  expect(unknown.status).toBe(200);
  expect(unknown.body).toStrictEqual({ revoked: false });
  expect(invalid.status).toBe(400);
  expect(invalid.body).toStrictEqual(invalidRequest);
});
