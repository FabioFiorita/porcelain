import { renameEnvironmentResponseSchema } from '@porcelain/contracts/access';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { inventory, watching } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const rename = (name: unknown, headers?: Record<string, string>) => ({
  method: 'PUT' as const,
  path: '/api/environment/name',
  body: { name },
  ...(headers ? { headers } : {}),
});
const environment = async (session: Session) =>
  record((await inventory(session)).environment);

test('the owner names the environment with the spaces trimmed and live viewers hear of it', async ({
  session,
}) => {
  const connection = await watching(session);

  const response = await session.send(rename('  Workstation  '));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(renameEnvironmentResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({ name: 'Workstation', custom: true });
  expect(await environment(session)).toStrictEqual({
    name: 'Workstation',
    custom: true,
  });
  expect(
    await connection.next((entry) => entry.type === 'inventory'),
  ).toStrictEqual({ type: 'inventory' });
});

test('clearing the environment name goes back to the host name', async ({
  session,
}) => {
  const response = await session.send(rename(null));

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ custom: false });
  expect(await environment(session)).toStrictEqual(record(response.body));
});

test('a relayed or remote request to rename the environment is refused and changes nothing', async ({
  session,
}) => {
  const before = await environment(session);

  const forwarded = await session.send(
    rename('Intruder', { 'x-forwarded-for': '203.0.113.9' }),
  );
  const tunnelled = await session.send(
    rename('Intruder', { 'cf-connecting-ip': '203.0.113.9' }),
  );

  expect(forwarded.status).toBe(403);
  expect(forwarded.body).toStrictEqual(notOnThisComputer);
  expect(tunnelled.status).toBe(403);
  expect(tunnelled.body).toStrictEqual(notOnThisComputer);
  expect(await environment(session)).toStrictEqual(before);
});
