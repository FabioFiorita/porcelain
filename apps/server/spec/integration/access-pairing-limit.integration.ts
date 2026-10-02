import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { issuePairing } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type Session } from '../kit/session.ts';

const limited = apiError(
  429,
  'Too Many Requests',
  'Too many pairing attempts. Wait a moment and try again.',
);
const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);
const attempt = (code: string): HttpRequest => ({
  method: 'POST',
  path: '/api/pair',
  auth: 'none',
  body: { code, platform: 'iOS' },
});
const fromPage = (code: string): HttpRequest => ({
  ...attempt(code),
  headers: { origin: 'http://page.example' },
});

async function sendAll(session: Session, requests: HttpRequest[]) {
  const responses = [];
  for (const request of requests) responses.push(await session.send(request));
  return responses;
}

test('pages on other origins that exhaust their pairing attempts cannot keep a same-origin device from pairing', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Phone');

  const failures = await sendAll(
    session,
    Array.from({ length: 10 }, () => fromPage('pcp_wrong')),
  );
  const page = await session.send(fromPage(code));
  const sameOrigin = await session.send(attempt(code));

  expect(failures.map((response) => response.status)).toStrictEqual(
    Array.from({ length: 10 }, () => 401),
  );
  expect(failures.map((response) => response.body)).toStrictEqual(
    Array.from({ length: 10 }, () => invalidLink),
  );
  expect(page.status).toBe(429);
  expect(page.body).toStrictEqual(limited);
  expect(sameOrigin.status).toBe(200);
  expect(record(sameOrigin.body).device).toMatchObject({
    label: 'Phone',
    platform: 'iOS',
  });
});

test('a successful pairing gives its attempt back, and ten failed attempts exhaust the allowance', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Phone');

  const failures = await sendAll(
    session,
    Array.from({ length: 9 }, () => attempt('pcp_wrong')),
  );
  const redeemed = await session.send(attempt(code));
  const tenthFailure = await session.send(attempt('pcp_wrong'));
  const next = await session.send(attempt('pcp_wrong'));

  expect(failures.map((response) => response.status)).toStrictEqual(
    Array.from({ length: 9 }, () => 401),
  );
  expect(failures.map((response) => response.body)).toStrictEqual(
    Array.from({ length: 9 }, () => invalidLink),
  );
  expect(redeemed.status).toBe(200);
  expect(record(redeemed.body).device).toMatchObject({
    label: 'Phone',
    platform: 'iOS',
  });
  expect(tenthFailure.status).toBe(401);
  expect(tenthFailure.body).toStrictEqual(invalidLink);
  expect(next.status).toBe(429);
  expect(next.body).toStrictEqual(limited);
});

test('once the allowance is exhausted even a valid pairing code is refused', async ({
  session,
}) => {
  const code = await issuePairing(session);

  const response = await session.send(attempt(code));

  expect(response.status).toBe(429);
  expect(response.body).toStrictEqual(limited);
});
