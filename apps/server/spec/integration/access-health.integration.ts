import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { inventory } from '../kit/reads.ts';
import { pairDevice } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

test('anyone asks for health without a credential and hears the server is up in its environment', async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/health',
    auth: 'none',
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    status: 'ok',
    environmentId: before.environmentId,
  });
  expect(response.body).toEqual(
    expect.schemaMatching(readHealthResponseSchema),
  );
});

test('health ignores a credential the server does not know or has revoked', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Revoked device');
  await session.read({
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: device.deviceId },
  });
  const { environmentId } = await inventory(session);

  const unknown = await session.send({
    method: 'GET',
    path: '/api/health',
    auth: { bearer: 'pcd_not-a-device' },
  });
  const revoked = await session.send({
    method: 'GET',
    path: '/api/health',
    auth: { bearer: device.credential },
  });

  expect(unknown.status).toBe(200);
  expect(unknown.body).toStrictEqual({ status: 'ok', environmentId });
  expect(revoked.status).toBe(200);
  expect(revoked.body).toStrictEqual({ status: 'ok', environmentId });
});
