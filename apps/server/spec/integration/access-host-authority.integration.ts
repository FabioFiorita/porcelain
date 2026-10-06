import * as Schema from 'effect/Schema';
import {
  listAccessResponseSchema,
  readRemoteAccessResponseSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import type { HttpRequest, Session } from '../kit/session.ts';

const notOnThisComputer = apiError(
  403,
  'Forbidden',
  'Sharing is managed from a browser on the computer that runs Porcelain',
);
const TUNNEL_PAGE = 'https://porcelain.example.com';

function hostPage(session: Session) {
  return new URL(session.address).origin;
}

async function sharing(session: Session) {
  return {
    access: await read(session, { method: 'GET', path: '/api/access' }),
    remoteAccess: await read(session, {
      method: 'GET',
      path: '/api/remote-access',
    }),
  };
}

test('the host browser on this computer reads and changes sharing', async ({
  session,
}) => {
  const devices = await session.send({
    method: 'GET',
    path: '/api/access',
    headers: {
      origin: hostPage(session),
      referer: `${hostPage(session)}/settings`,
      'sec-fetch-site': 'same-origin',
    },
  });
  const routes = await session.send({
    method: 'GET',
    path: '/api/remote-access',
    headers: {
      referer: `${hostPage(session)}/settings`,
      'sec-fetch-site': 'same-origin',
    },
  });
  const revoked = await session.send({
    method: 'POST',
    path: '/api/access/revoke',
    headers: {
      origin: hostPage(session),
      referer: `${hostPage(session)}/settings`,
      'sec-fetch-site': 'same-origin',
    },
    body: { id: 'unknown' },
  });

  expect(devices.status).toBe(200);
  expect(devices.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(routes.status).toBe(200);
  expect(routes.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readRemoteAccessResponseSchema),
      ),
    ),
  );
  expect(revoked.status).toBe(200);
  expect(revoked.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(revokeAccessResponseSchema)),
    ),
  );
});

test('a browser that asked from another page is refused sharing and changes nothing', async ({
  session,
}) => {
  const before = await sharing(session);
  const requests: HttpRequest[] = [
    { method: 'GET', path: '/api/access', headers: { origin: TUNNEL_PAGE } },
    {
      method: 'GET',
      path: '/api/remote-access',
      headers: { referer: `${TUNNEL_PAGE}/settings` },
    },
    {
      method: 'GET',
      path: '/api/access',
      headers: { origin: 'http://127.0.0.1:1' },
    },
    {
      method: 'GET',
      path: '/api/remote-access',
      headers: { 'sec-fetch-site': 'cross-site' },
    },
    {
      method: 'POST',
      path: '/api/access/revoke',
      headers: {
        referer: `${hostPage(session)}/settings`,
        'sec-fetch-site': 'same-site',
      },
      body: { id: 'unknown' },
    },
  ];
  const responses = [];

  for (const request of requests) responses.push(await session.send(request));

  expect(
    responses.map((response) => ({
      status: response.status,
      body: response.body,
    })),
  ).toStrictEqual([
    { status: 403, body: notOnThisComputer },
    { status: 403, body: notOnThisComputer },
    { status: 403, body: notOnThisComputer },
    { status: 403, body: notOnThisComputer },
    { status: 403, body: notOnThisComputer },
  ]);
  expect(await sharing(session)).toStrictEqual(before);
});
