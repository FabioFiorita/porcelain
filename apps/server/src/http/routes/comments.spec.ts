import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commentThreadsSchema } from '@porcelain/contracts/comments';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };
it('persists authenticated discussion across refresh, unavailability and restart over real HTTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comments-'));
  const path = join(root, 'repo');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const dataDirectory = join(root, 'state');
  const server = await createServer({ dataDirectory, token });
  try {
    const project = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/projects',
          headers,
          payload: { path },
        })
      ).json(),
    );
    const worktreeId = project.worktrees[0]?.id;
    const url = `/worktrees/${worktreeId}/comments`;
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual([]);
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const created = await fetch(`${address}${url}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: {
          kind: 'codeRange',
          filePath: 'notes:today.txt',
          startLine: 1,
          endLine: 3,
          revision: 'opaque-revision',
          contentFingerprint: 'opaque-fingerprint',
        },
        body: '<script>plain text</script>',
      }),
    });
    expect(created.status).toBe(200);
    const [thread] = commentThreadsSchema.parse(await created.json());
    if (!thread) throw new Error('Missing thread');
    for (let count = 1; count < 100; count++) {
      expect(
        (
          await server.inject({
            method: 'POST',
            url,
            headers,
            payload: {
              anchor: { kind: 'file', filePath: 'a' },
              body: 'bounded',
            },
          })
        ).statusCode,
      ).toBe(200);
    }
    const overflow = await server.inject({
      method: 'POST',
      url,
      headers,
      payload: { anchor: { kind: 'file', filePath: 'a' }, body: 'overflow' },
    });
    expect(overflow.statusCode).toBe(409);
    expect(overflow.json()).toEqual({
      code: 'COMMENT_LIMIT_EXCEEDED',
      message: 'Comment capacity exceeded',
    });
    const replyUrl = `${url}/${thread.id}/replies`;
    const resolutionUrl = `${url}/${thread.id}/resolution`;
    const replies = await Promise.all(
      ['one', 'two'].map((body) =>
        server.inject({
          method: 'POST',
          url: replyUrl,
          headers,
          payload: { body },
        }),
      ),
    );
    expect(replies.map((reply) => reply.statusCode)).toEqual([200, 200]);
    const resolved = await server.inject({
      method: 'PUT',
      url: resolutionUrl,
      headers,
      payload: { resolved: true },
    });
    expect(resolved.statusCode).toBe(200);
    expect(
      (
        await server.inject({
          method: 'PUT',
          url: resolutionUrl,
          headers,
          payload: { resolved: true },
        })
      ).json(),
    ).toEqual(resolved.json());
    await server.inject({ method: 'POST', url: '/inventory/refresh', headers });
    await rename(path, join(root, 'moved'));
    await server.inject({ method: 'POST', url: '/inventory/refresh', headers });
    await server.close();
    const restarted = await createServer({ dataDirectory, token });
    try {
      const result = await restarted.inject({ method: 'GET', url, headers });
      expect(result.statusCode).toBe(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(commentThreadsSchema.parse(result.json())[0]).toEqual(
        commentThreadsSchema.parse(resolved.json())[0],
      );
      expect(commentThreadsSchema.parse(result.json())).toHaveLength(100);
      expect(
        commentThreadsSchema
          .parse(result.json())[0]
          ?.messages.map((message) => message.body),
      ).toEqual(['<script>plain text</script>', 'one', 'two']);
    } finally {
      await restarted.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
it('authenticates every operation and rejects malformed anchors, bodies and cross-scope targets safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comments-errors-'));
  const server = await createServer({ dataDirectory: root, token });
  const url = '/worktrees/00000000-0000-4000-8000-000000000001/comments';
  const threadUrl = `${url}/00000000-0000-4000-8000-000000000002`;
  try {
    for (const [method, route] of [
      ['GET', url],
      ['POST', url],
      ['POST', `${threadUrl}/replies`],
      ['PUT', `${threadUrl}/resolution`],
    ] as const) {
      expect((await server.inject({ method, url: route })).statusCode).toBe(
        401,
      );
    }
    const unknown = await server.inject({ method: 'GET', url, headers });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({
      code: 'WORKTREE_NOT_FOUND',
      message: 'Worktree not found',
    });
    const valid = { anchor: { kind: 'file', filePath: 'a.ts' }, body: 'hello' };
    for (const payload of [
      ...[
        '/a',
        '.git',
        'nested/.git/config',
        '.GIT/config',
        'C:/a',
        'z:relative',
        'x'.repeat(4097),
        '../a',
        'a//b',
        './a',
        'a/../b',
        'a\\b',
        'C:a',
        'a\0',
      ].map((filePath) => ({ ...valid, anchor: { kind: 'file', filePath } })),
      ...['', ' ', 'x'.repeat(16001), 'a\0'].map((body) => ({
        ...valid,
        body,
      })),
      { ...valid, extra: true },
      {
        ...valid,
        anchor: { kind: 'codeRange', filePath: 'a', startLine: 3, endLine: 2 },
      },
      {
        ...valid,
        anchor: { kind: 'codeRange', filePath: 'a', startLine: 0, endLine: 2 },
      },
      { ...valid, anchor: { kind: 'diff', filePath: 'a' } },
    ]) {
      const response = await server.inject({
        method: 'POST',
        url,
        headers,
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
      });
    }
    for (const [method, route, payload] of [
      ['POST', url, valid],
      ['POST', `${threadUrl}/replies`, { body: 'reply' }],
      ['PUT', `${threadUrl}/resolution`, { resolved: true }],
    ] as const) {
      const result = await server.inject({
        method,
        url: route,
        headers,
        payload,
      });
      expect(result.statusCode).toBe(404);
      expect(result.json()).toEqual({
        code: 'NOT_FOUND',
        message: 'Comment target not found',
      });
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
