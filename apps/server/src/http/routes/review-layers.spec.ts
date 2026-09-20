import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import { Git } from '@porcelain/git/git';
import { expect, it } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

it('stores ordered metadata with atomic revision conflicts, refresh retention and restart durability over HTTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layers-'));
  const dataDirectory = join(root, 'state');
  const path = join(root, 'repo');
  execFileSync('git', ['init', '-b', 'main', path]);
  const server = await createServer({
    pairingReach,
    dataDirectory,
    projectHome: dataDirectory,
  });
  const headers = await pairDevice(server, server.application);
  try {
    const registered = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path },
    });
    const worktreeId = projectResponseSchema.parse(registered.json())
      .worktrees[0]?.id;
    const url = `/api/worktrees/${worktreeId}/review-layers`;
    const layers = [
      {
        id: randomUUID(),
        title: 'First',
        summary: 'The first focused review layer.',
        files: [
          {
            path: 'unknown/file.ts',
            scope: 'unstaged',
            note: 'This note survives the server round-trip.',
          },
        ],
      },
      {
        id: randomUUID(),
        title: 'Second',
        summary: 'The second focused review layer.',
        files: [
          { path: 'unknown/file.ts', scope: 'staged' },
          {
            path: 'deleted.ts',
            scope: 'unstaged',
            note: 'Keep the scope attached to the path.',
          },
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
    await server.inject({
      method: 'GET',
      url: '/api/inventory',
      headers,
    });
    expect(
      (await server.inject({ method: 'GET', url, headers })).json(),
    ).toEqual(updated.json());
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/api/worktrees/${'0'.repeat(32)}/review-layers`,
          headers,
        })
      ).statusCode,
    ).toBe(404);
    // A worktree id is derived, so one shaped like the ids this replaced is
    // refused at the boundary rather than looked up.
    expect(
      (
        await server.inject({
          method: 'GET',
          url: `/api/worktrees/${randomUUID()}/review-layers`,
          headers,
        })
      ).statusCode,
    ).toBe(400);
    await server.close();
    const restarted = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
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

it('cancels the listing a review-layers read started when the client disconnects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layers-disconnect-'));
  const dataDirectory = join(root, 'state');
  const path = join(root, 'repo');
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  let block = false;
  const server = await createServer({
    pairingReach,
    dataDirectory,
    projectHome: dataDirectory,
    git: (checkout) => ({
      listWorktrees: (signal) => {
        if (!block) return new Git(checkout).listWorktrees(signal);
        return new Promise((_resolve, reject) => {
          if (!signal) throw new Error('Missing cancellation');
          signal.addEventListener(
            'abort',
            () => {
              cancelled.resolve();
              reject(signal.reason);
            },
            { once: true },
          );
          entered.resolve();
        });
      },
    }),
  });
  const headers = await pairDevice(server, server.application);
  const leaving = new AbortController();
  try {
    await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { path },
    });
    // Reading layers now asks whether the worktree exists, and an id nothing
    // has listed costs a listing. A reader who leaves must take that Git work
    // with them, exactly as they would a status read.
    block = true;
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const response = fetch(
      `${address}/api/worktrees/${'a'.repeat(32)}/review-layers`,
      { headers, signal: leaving.signal },
    ).catch((error: unknown) => error);
    await entered.promise;
    leaving.abort();
    await cancelled.promise;
    expect(await response).toMatchObject({ name: 'AbortError' });
  } finally {
    leaving.abort();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
