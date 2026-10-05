import * as Schema from 'effect/Schema';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { apiError, deviceCookieForm, unauthenticated } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { read, pairBrowser } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, type Session } from '../kit/session.ts';

async function devices(session: Session) {
  return list(
    (await read(session, { method: 'GET', path: '/access', target: 'owner' }))
      .devices,
  );
}

test('a browser device cookie reads the inventory exactly as the bearer credential does and is refreshed', async ({
  session,
}) => {
  const { cookie } = await pairBrowser(session);
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { cookie },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual(before);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readInventoryResponseSchema)),
    ),
  );
  expect(response.headers['set-cookie']).toMatch(deviceCookieForm);
});

test('a device cookie the server does not know is refused and sets no cookie', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { cookie: 'porcelain_device=pcd_unknown' },
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
  expect(response.headers['set-cookie']).toBeUndefined();
});

test('clearing the session without the browser request header is refused and sets no cookie', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: '/api/session',
    auth: 'none',
  });

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(403, 'Forbidden', 'Browser request header required'),
  );
  expect(response.headers['set-cookie']).toBeUndefined();
});

test('clearing the session from a browser expires its cookie without revoking any device', async ({
  session,
}) => {
  const before = await devices(session);

  const response = await session.send({
    method: 'DELETE',
    path: '/api/session',
    auth: 'none',
    headers: { 'x-porcelain-browser': '1' },
  });

  expect(response.status).toBe(204);
  expect(response.body).toBeUndefined();
  expect(response.headers['set-cookie']).toBe(
    'porcelain_device=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0',
  );
  expect(await devices(session)).toStrictEqual(before);
});
