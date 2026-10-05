import * as Schema from 'effect/Schema';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { unauthenticated } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';

test("the desktop app's session credential reads the inventory as a paired device does", async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: 'desktop',
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual(before);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readInventoryResponseSchema)),
    ),
  );
});

test('a desktop session credential the server did not start with is refused and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { bearer: 'a-previous-launch-desktop-credential' },
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(unauthenticated);
  expect(response.headers['www-authenticate']).toBe('Bearer');
  expect(await inventory(session)).toStrictEqual(before);
});
