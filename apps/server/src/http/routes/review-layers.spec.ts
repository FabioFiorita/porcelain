import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

it('stores ordered metadata with atomic revision conflicts, refresh retention and restart durability over HTTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layers-'));
  const token = 'isolated-review-layers-test-token-12345';
  const headers = { authorization: `Bearer ${token}` };
  const dataDirectory = join(root, 'state');
  const path = join(root, 'repo');
  execFileSync('git', ['init', '-b', 'main', path]);
  const server = await createServer({ dataDirectory, token });
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    const worktreeId = projectResponseSchema.parse(registered.json())
      .worktrees[0]?.id;
    const url = `/worktrees/${worktreeId}/review-layers`;
    const layers = [
      {
        id: randomUUID(),
        title: 'First',
        files: [{ path: 'unknown/file.ts', scope: 'unstaged' }],
      },
      {
        id: randomUUID(),
        title: 'Second',
        files: [
          { path: 'unknown/file.ts', scope: 'staged' },
          { path: 'deleted.ts', scope: 'unstaged' },
        ],
      },
    ];
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const unauthenticated = await fetch(`${address}${url}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(unauthenticated.status).toBe(401);
    const initial = await server.inject({ method: 'GET', url, headers });
    expect(initial.json()).toEqual({ worktreeId, revision: 0, layers: [] });
    expect(initial.headers['cache-control']).toBe('no-store');
    const results = await Promise.all(
      [layers, [...layers].reverse()].map((value) =>
        server.inject({
          method: 'PUT',
          url,
          headers,
          payload: { expectedRevision: 0, layers: value },
        }),
      ),
    );
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      200, 409,
    ]);
    const winner = results.find((result) => result.statusCode === 200);
    const stored = reviewLayersResponseSchema.parse(winner?.json());
    expect(stored.revision).toBe(1);
    const reordered = [...stored.layers]
      .reverse()
      .map((layer) => ({ ...layer, files: [...layer.files].reverse() }));
    const updated = await server.inject({
      method: 'PUT',
      url,
      headers,
      payload: { expectedRevision: 1, layers: reordered },
    });
    expect(updated.json()).toEqual({
      worktreeId,
      revision: 2,
      layers: reordered,
    });
    for (const badPath of [
      '../escape',
      '/absolute',
      'a//b',
      'a/./b',
      'a\\b',
      'C:/x',
      'a\0b',
      'a/',
    ]) {
      const invalid = await server.inject({
        method: 'PUT',
        url,
        headers,
        payload: {
          expectedRevision: 2,
          layers: [
            {
              id: randomUUID(),
              title: 'Invalid',
              files: [{ path: badPath, scope: 'unstaged' }],
            },
          ],
        },
      });
      expect(invalid.statusCode).toBe(400);
    }
    const duplicate = await server.inject({
      method: 'PUT',
      url,
      headers,
      payload: { expectedRevision: 2, layers: [layers[0], layers[0]] },
    });
    expect(duplicate.statusCode).toBe(400);
    await server.inject({ method: 'POST', url: '/inventory/refresh', headers });
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual(updated.json());
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/worktrees/${randomUUID()}/review-layers`,
          headers,
        })
      ).statusCode,
    ).toBe(404);
    await server.close();
    const restarted = await createServer({ dataDirectory, token });
    try {
      expect(
        (await restarted.inject({ method: 'GET', url, headers })).json(),
      ).toEqual(updated.json());
      expect(
        (
          await restarted.inject({
            method: 'PUT',
            url,
            headers,
            payload: { expectedRevision: 2, layers: [] },
          })
        ).json(),
      ).toEqual({ worktreeId, revision: 3, layers: [] });
    } finally {
      await restarted.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
