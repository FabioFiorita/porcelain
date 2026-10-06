import * as Schema from 'effect/Schema';
import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  setDeviceTrustResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { pairDevice, read, owner } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

function listed(entries: unknown, id: unknown) {
  const entry = record(list(entries).find((item) => record(item).id === id));
  return { label: entry.label, trusted: entry.trusted };
}

const ownerAccess = owner({ method: 'GET', path: '/access' });
const notFound = apiError(404, 'Not Found', 'Device not found');

test('a pairing link issued as trusted is listed as trusted while pending and pairs a trusted device', async ({
  session,
}) => {
  const response = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Desktop'],
        addresses: [session.address],
        trusted: true,
      },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(issuePairingResponseSchema)),
    ),
  );
  const issued = record(list(record(response.body).grants)[0]);
  const grant = record(issued.grant);
  expect(grant).toMatchObject({ label: 'Desktop', trusted: true });
  const pending = await read(session, ownerAccess);
  expect(pending).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(listed(pending.grants, grant.id)).toStrictEqual({
    label: 'Desktop',
    trusted: true,
  });
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code: text(issued.code), platform: 'macOS' },
  });
  const deviceId = record(paired.device).id;
  const listing = await read(session, ownerAccess);
  expect(listed(listing.devices, deviceId)).toStrictEqual({
    label: 'Desktop',
    trusted: true,
  });
});

test('an ordinary pairing link pairs an untrusted device', async ({
  session,
}) => {
  const issued = await read(
    session,
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Phone'], addresses: [session.address] },
    }),
  );
  const link = record(list(issued.grants)[0]);
  const code = text(link.code);
  const grant = record(link.grant);

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'iOS' },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).device).toMatchObject({
    label: 'Phone',
    platform: 'iOS',
  });
  expect(grant).toMatchObject({ label: 'Phone', trusted: false });
  const deviceId = record(record(response.body).device).id;
  const listing = await read(session, ownerAccess);
  expect(listed(listing.devices, deviceId)).toStrictEqual({
    label: 'Phone',
    trusted: false,
  });
});

test('the owner trusts a paired device by its id, the listing says so, and then stops trusting it', async ({
  session,
}) => {
  const { deviceId } = await pairDevice(session, 'Laptop');

  const trusted = await session.send(
    owner({
      method: 'POST',
      path: '/access/trust',
      body: { id: deviceId, trusted: true },
    }),
  );
  const listing = await session.send(ownerAccess);
  const untrusted = await session.send(
    owner({
      method: 'POST',
      path: '/access/trust',
      body: { id: deviceId, trusted: false },
    }),
  );

  expect(trusted.status).toBe(200);
  expect(trusted.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(setDeviceTrustResponseSchema)),
    ),
  );
  expect(trusted.body).toStrictEqual({ id: deviceId, trusted: true });
  expect(listing.status).toBe(200);
  expect(listed(record(listing.body).devices, deviceId)).toStrictEqual({
    label: 'Laptop',
    trusted: true,
  });
  expect(untrusted.status).toBe(200);
  expect(untrusted.body).toStrictEqual({ id: deviceId, trusted: false });
  expect(
    listed((await read(session, ownerAccess)).devices, deviceId),
  ).toStrictEqual({ label: 'Laptop', trusted: false });
});

test('trusting an unknown device is not found and a malformed trust request changes nothing', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);

  const unknown = await session.send(
    owner({
      method: 'POST',
      path: '/access/trust',
      body: { id: 'pcd_unknown', trusted: true },
    }),
  );
  const malformed = await session.send(
    owner({
      method: 'POST',
      path: '/access/trust',
      body: { id: 'pcd_unknown', trusted: true, label: 'extra' },
    }),
  );

  expect([unknown.status, malformed.status]).toStrictEqual([404, 400]);
  expect(unknown.body).toStrictEqual(notFound);
  expect(malformed.body).toStrictEqual(invalidRequest);
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});
