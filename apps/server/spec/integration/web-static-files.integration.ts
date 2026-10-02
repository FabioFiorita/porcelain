import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest } from '../kit/session.ts';

const notFound = apiError(404, 'Not Found', 'Not Found');

function page(path: string): HttpRequest {
  return { method: 'GET', path, auth: 'none' };
}

test('the root answers the web shell, revalidated, and HEAD answers its headers without a body', async ({
  session,
}) => {
  const get = await session.send(page('/'));
  const head = await session.send({ ...page('/'), method: 'HEAD' });

  expect(get.status).toBe(200);
  expect(get.body).toBe(session.fixture.web.shell);
  expect(get.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(get.headers['cache-control']).toBe('no-cache');
  expect(head.status).toBe(200);
  expect(head.body).toBeUndefined();
  expect(head.headers['content-length']).toBe(
    String(Buffer.byteLength(session.fixture.web.shell)),
  );
});

test('a hashed asset is served with its media type and cached for good', async ({
  session,
}) => {
  const response = await session.send(
    page(`/${session.fixture.web.asset.path}`),
  );

  expect(response.status).toBe(200);
  expect(response.body).toBe(session.fixture.web.asset.text);
  expect(response.headers['content-type']).toBe(
    'text/javascript; charset=utf-8',
  );
  expect(response.headers['cache-control']).toBe(
    'public, max-age=31536000, immutable',
  );
});

test('a client route answers the web shell, revalidated', async ({
  session,
}) => {
  const response = await session.send(page('/projects/any/worktrees/route'));

  expect(response.status).toBe(200);
  expect(response.body).toBe(session.fixture.web.shell);
  expect(response.headers['cache-control']).toBe('no-cache');
});

test('a missing file or a path under /api is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(page('/assets/missing-12345678.js')),
    await session.send(page('/robots.txt')),
    await session.send(page('/api/unknown')),
  ];

  expect(responses.map((response) => response.status)).toStrictEqual([
    404, 404, 404,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    notFound,
    notFound,
    notFound,
  ]);
});

test('a path or a symbolic link that leads out of the web root is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(page('/%2e%2e/credential.json')),
    await session.send(page('/..%2fcredential.json')),
    await session.send(page(`/${session.fixture.web.escape}`)),
  ];

  expect(responses.map((response) => response.status)).toStrictEqual([
    404, 404, 404,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    notFound,
    notFound,
    notFound,
  ]);
});
