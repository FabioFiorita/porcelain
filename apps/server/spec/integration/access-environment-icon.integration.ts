import { setEnvironmentIconResponseSchema } from '@porcelain/contracts/access';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { inventory, watching } from '../kit/reads.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const setIcon = (icon: unknown, headers?: Record<string, string>) => ({
  method: 'PUT' as const,
  path: '/api/environment/icon',
  body: { icon },
  ...(headers ? { headers } : {}),
});
const rename = (name: unknown) => ({
  method: 'PUT' as const,
  path: '/api/environment/name',
  body: { name },
});
const environment = async (session: Session) =>
  record((await inventory(session)).environment);

test('the owner gives the environment an icon and live viewers hear of it', async ({
  session,
}) => {
  const connection = await watching(session);
  const { name } = await environment(session);

  const response = await session.send(setIcon('laptop'));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(setEnvironmentIconResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({ name, custom: false, icon: 'laptop' });
  expect(await environment(session)).toStrictEqual({
    name,
    custom: false,
    icon: 'laptop',
  });
  expect(
    await connection.next((entry) => entry.type === 'inventory'),
  ).toStrictEqual({ type: 'inventory' });
});

test('renaming keeps the icon and changing the icon keeps the name', async ({
  session,
}) => {
  await read(session, setIcon('server'));

  const renamed = await session.send(rename('Workstation'));
  const changed = await session.send(setIcon('cloud'));

  expect(renamed.status).toBe(200);
  expect(changed.status).toBe(200);
  expect(renamed.body).toStrictEqual({
    name: 'Workstation',
    custom: true,
    icon: 'server',
  });
  expect(changed.body).toStrictEqual({
    name: 'Workstation',
    custom: true,
    icon: 'cloud',
  });
  expect(await environment(session)).toStrictEqual({
    name: 'Workstation',
    custom: true,
    icon: 'cloud',
  });
});

test('clearing the icon leaves the environment without one', async ({
  session,
}) => {
  await read(session, setIcon('server'));

  const response = await session.send(setIcon(null));

  expect(response.status).toBe(200);
  expect(record(response.body)).not.toHaveProperty('icon');
  expect(await environment(session)).toStrictEqual(record(response.body));
});

test('an icon outside the set is refused and changes nothing', async ({
  session,
}) => {
  await read(session, setIcon('server'));

  const response = await session.send(setIcon('toaster'));

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
  expect(await environment(session)).toMatchObject({ icon: 'server' });
});

test('a relayed or remote request to change the icon is refused and changes nothing', async ({
  session,
}) => {
  const before = await environment(session);

  const forwarded = await session.send(
    setIcon('cloud', { 'x-forwarded-for': '203.0.113.9' }),
  );
  const tunnelled = await session.send(
    setIcon('cloud', { 'cf-connecting-ip': '203.0.113.9' }),
  );

  expect(forwarded.status).toBe(403);
  expect(forwarded.body).toStrictEqual(notOnThisComputer);
  expect(tunnelled.status).toBe(403);
  expect(tunnelled.body).toStrictEqual(notOnThisComputer);
  expect(await environment(session)).toStrictEqual(before);
});
