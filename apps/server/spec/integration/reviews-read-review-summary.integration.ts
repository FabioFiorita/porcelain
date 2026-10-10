import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { invalidRequest, literally } from '../kit/answers.ts';
import {
  read,
  SAMPLE_SUMMARY_HTML,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, text, type Session } from '../kit/session.ts';

async function summaryUrl(session: Session) {
  const current = (
    await read(session, {
      method: 'GET',
      path: worktreePath(session, '/review'),
    })
  ).review;
  const revision = current === null ? 0 : Number(record(current).revision);
  const answer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, revision, randomUUID(), randomUUID()),
  });
  return new URL(
    String(record(record(answer.review).summary).url),
    session.address,
  );
}

test('a signed summary link serves the published page with the bridge before the closing body, sandboxed, uncached and without referrer', async ({
  session,
}) => {
  const url = await summaryUrl(session);

  const response = await session.send({
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    auth: 'none',
  });

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(response.headers['content-security-policy']).toBe(
    'sandbox allow-scripts allow-forms allow-popups allow-modals',
  );
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers['referrer-policy']).toBe('no-referrer');
  const html = text(response.body);
  const [published = '', closing = ''] = SAMPLE_SUMMARY_HTML.split('</body>');
  const opening = `${published}<style id="porcelain-theme">`;
  const ending = `</script></body>${closing}`;
  expect(html).toMatch(new RegExp(`^${literally(opening)}`));
  expect(html).toMatch(new RegExp(`${literally(ending)}$`));
});

test('a summary link with a wrong signature or a tampered expiry is not found with an empty body', async ({
  session,
}) => {
  const url = await summaryUrl(session);

  const responses = [
    await session.send({
      method: 'GET',
      path: `${url.pathname}?expires=${url.searchParams.get('expires')}&signature=${'A'.repeat(43)}`,
      auth: 'none',
    }),
    await session.send({
      method: 'GET',
      path: `${url.pathname}?expires=${encodeURIComponent('2020-01-01T00:00:00.000Z')}&signature=${url.searchParams.get('signature')}`,
      auth: 'none',
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([404, 404]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    undefined,
    undefined,
  ]);
});

test('a summary link served before it expired is not found with an empty body once it has expired', async ({
  session,
  server,
}) => {
  const url = await summaryUrl(session);
  const link = {
    method: 'GET' as const,
    path: `${url.pathname}${url.search}`,
    auth: 'none' as const,
  };
  await session.read(link);
  await server.advanceTime(session.fixture.summaryLinkLifetimeMs + 100);

  const response = await session.send(link);

  expect(response.status).toBe(404);
  expect(response.body).toBeUndefined();
});

test('the link of a replaced summary is not found with an empty body', async ({
  session,
}) => {
  const replaced = await summaryUrl(session);
  await summaryUrl(session);

  const response = await session.send({
    method: 'GET',
    path: `${replaced.pathname}${replaced.search}`,
    auth: 'none',
  });

  expect(response.status).toBe(404);
  expect(response.body).toBeUndefined();
});

test('a summary link without its signature or with a malformed token is invalid', async ({
  session,
}) => {
  const url = await summaryUrl(session);

  const responses = [
    await session.send({ method: 'GET', path: url.pathname, auth: 'none' }),
    await session.send({
      method: 'GET',
      path: `/review-summaries/not-a-token${url.search}`,
      auth: 'none',
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([400, 400]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    invalidRequest,
    invalidRequest,
  ]);
});
