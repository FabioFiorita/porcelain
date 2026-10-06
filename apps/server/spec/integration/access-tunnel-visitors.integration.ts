import * as Schema from 'effect/Schema';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import {
  apiError,
  deviceCookieForm,
  literally,
  unauthenticated,
} from '../kit/answers.ts';
import { tunnelOn } from '../kit/reads.ts';
import { issuePairing } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type HttpResponse } from '../kit/session.ts';

const TUNNEL_HOST = 'porcelain.example.com';
const TUNNEL_PAGE = `https://${TUNNEL_HOST}`;
const secureCookieForm = new RegExp(
  `${deviceCookieForm.source.replace(/\$$/, '')}${literally('; Secure')}$`,
);
const STRICT_TRANSPORT = 'max-age=31536000';
const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);
const limited = apiError(
  429,
  'Too Many Requests',
  'Too many pairing attempts. Wait a moment and try again.',
);

function throughTunnel(visitor: string | undefined): Record<string, string> {
  return {
    host: TUNNEL_HOST,
    origin: TUNNEL_PAGE,
    ...(visitor === undefined ? {} : { 'cf-connecting-ip': visitor }),
  };
}

function attempt(
  code: string,
  headers: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers,
    body: { code, platform: 'iOS' },
  };
}

function cookieOf(header: string | undefined) {
  const cookie = /porcelain_device=[^;]+/.exec(header ?? '')?.[0];
  if (!cookie) throw new Error('Pairing set no device cookie');
  return cookie;
}

test('a browser that pairs through the tunnel keeps a secure cookie and is told to use HTTPS only', async ({
  session,
}) => {
  await tunnelOn(session, TUNNEL_HOST);
  const code = await issuePairing(session, 'Phone');

  const response = await session.send(
    attempt(code, {
      ...throughTunnel(undefined),
      'x-porcelain-browser': '1',
    }),
  );

  expect(response.status).toBe(200);
  expect(record(response.body).device).toMatchObject({
    label: 'Phone',
    platform: 'iOS',
  });
  expect(response.headers['set-cookie']).toMatch(secureCookieForm);
  expect(response.headers['strict-transport-security']).toBe(STRICT_TRANSPORT);
});

test('the cookie a tunnel visitor sends back stays for HTTPS only and works only through the tunnel', async ({
  session,
}) => {
  const paired = await session.read(
    attempt(await issuePairing(session, 'Tablet'), {
      ...throughTunnel(undefined),
      'x-porcelain-browser': '1',
    }),
  );
  const cookie = cookieOf(paired.headers['set-cookie']);

  const tunnelRead = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { cookie },
    headers: throughTunnel(undefined),
  });
  const directRead = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { cookie },
  });

  expect(tunnelRead.status).toBe(200);
  expect(tunnelRead.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readInventoryResponseSchema)),
    ),
  );
  expect(tunnelRead.headers['set-cookie']).toMatch(secureCookieForm);
  expect(tunnelRead.headers['strict-transport-security']).toBe(
    STRICT_TRANSPORT,
  );
  expect(directRead.status).toBe(401);
  expect(directRead.body).toStrictEqual(unauthenticated);
  expect(directRead.headers['set-cookie']).toBeUndefined();
});

test('each tunnel visitor has its own pairing attempt allowance', async ({
  session,
}) => {
  await tunnelOn(session, TUNNEL_HOST);

  const failures: HttpResponse[] = [];
  for (let index = 0; index < 10; index += 1)
    failures.push(
      await session.send(attempt('pcp_wrong', throughTunnel('203.0.113.7'))),
    );
  const sameVisitor = await session.send(
    attempt('pcp_wrong', throughTunnel('203.0.113.7')),
  );
  const otherVisitor = await session.send(
    attempt('pcp_wrong', throughTunnel('198.51.100.2')),
  );

  for (const response of failures) {
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(invalidLink);
  }
  expect(sameVisitor.status).toBe(429);
  expect(sameVisitor.body).toStrictEqual(limited);
  expect(otherVisitor.status).toBe(401);
  expect(otherVisitor.body).toStrictEqual(invalidLink);
});

test('a visitor address off the tunnel is ignored so the loopback peer exhausts one allowance', async ({
  session,
}) => {
  const failures: HttpResponse[] = [];
  for (let index = 0; index < 10; index += 1)
    failures.push(
      await session.send(
        attempt('pcp_wrong', { 'cf-connecting-ip': `192.0.2.${index + 1}` }),
      ),
    );
  const loopbackPeer = await session.send(
    attempt('pcp_wrong', { 'cf-connecting-ip': '192.0.2.99' }),
  );

  for (const response of failures) {
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual(invalidLink);
  }
  expect(loopbackPeer.status).toBe(429);
  expect(loopbackPeer.body).toStrictEqual(limited);
});
