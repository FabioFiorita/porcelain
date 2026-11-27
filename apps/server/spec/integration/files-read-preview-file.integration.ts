import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vite-plus/test';
import { CREDENTIAL_LINK } from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';
import { test } from '../kit/server-test.ts';

test('streams an authorized worktree file and byte slice, and confines the ticket to that file and lifetime', async ({
  session,
  server,
}) => {
  await session.writeFile('demo.mp4', 'abcdefghij');
  await session.writeFile('other.mp4', 'different');
  const mint = await session.read({
    method: 'POST',
    path: worktreePath(session, '/preview-assets'),
    body: { document: 'README.md', paths: ['demo.mp4'], streamMedia: true },
  });
  const asset = record(list(record(mint.body).assets)[0]);
  expect(asset.kind).toBe('stream');
  const ticket = text(asset.ticket);
  session.secret(ticket);
  const request = {
    method: 'GET',
    path: worktreePath(session, '/preview-file'),
    query: { path: 'demo.mp4', ticket },
    auth: 'none',
  } as const;

  const full = await session.read(request);
  expect(full.body).toBe('abcdefghij');
  expect(full.headers).toMatchObject({
    'content-type': 'video/mp4',
    'content-length': '10',
    'accept-ranges': 'bytes',
  });

  const part = await session.read(
    { ...request, headers: { Range: 'bytes=2-4' } },
    206,
  );
  expect(part.body).toBe('cde');
  expect(part.headers).toMatchObject({
    'content-length': '3',
    'content-range': 'bytes 2-4/10',
  });
  const etag = text(full.headers.etag);
  await session.read({ ...request, headers: { 'If-None-Match': etag } }, 304);
  const unsatisfied = await session.read(
    { ...request, headers: { Range: 'bytes=10-' } },
    416,
  );
  expect(unsatisfied.headers['content-range']).toBe('bytes */10');

  await session.read({ ...request, query: { path: 'demo.mp4' } }, 401);
  await session.read({ ...request, query: { path: 'other.mp4', ticket } }, 401);
  await session.read(
    {
      ...request,
      query: {
        path: 'demo.mp4',
        ticket: `${ticket.startsWith('A') ? 'B' : 'A'}${ticket.slice(1)}`,
      },
    },
    401,
  );
  await server.advanceTime(30 * 60 * 1000);
  await session.read(request, 401);
});

test('refuses traversal, .git and symlinks and serves markup or scripts as inert bytes', async ({
  session,
}) => {
  await session.symlink(CREDENTIAL_LINK, 'escape.png');
  await mkdir(join(session.repository, '%2e%2e'));
  await session.writeFile('%2e%2e/literal.png', 'must not resolve');
  await session.writeFile('page.html', '<script>alert(1)</script>');
  await session.writeFile('script.js', 'alert(1)');
  const path = worktreePath(session, '/preview-file');
  for (const invalid of ['../outside.png', '/logo.png', '.Git/config']) {
    await session.read({ method: 'GET', path, query: { path: invalid } }, 400);
  }
  for (const refused of ['escape.png', '%2e%2e/literal.png']) {
    await session.read({ method: 'GET', path, query: { path: refused } }, 404);
  }
  for (const markup of ['page.html', 'script.js']) {
    const result = await session.read({
      method: 'GET',
      path,
      query: { path: markup },
    });
    expect(result.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(result.headers['x-content-type-options']).toBe('nosniff');
  }
});
