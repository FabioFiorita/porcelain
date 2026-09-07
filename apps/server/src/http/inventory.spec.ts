import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inventoryResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from './server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

it('registers, refreshes and persists inventory through authenticated HTTP', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'porcelain-api-')));
  const path = join(root, 'project');
  const dataDirectory = join(root, 'state');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const server = await createServer({ dataDirectory, token });
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const register = await fetch(`${address}/projects`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    expect(register.status).toBe(200);
    const raw: unknown = await register.json();
    const project = projectResponseSchema.parse(raw);
    expect(raw).toEqual(project);
    expect(project.worktrees).toMatchObject([
      { path, main: true, available: true },
    ]);
    const duplicate = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path },
    });
    expect(duplicate.json()).toEqual(project);
    const initial = await server.inject({
      method: 'GET',
      url: '/inventory',
      headers,
    });
    const inventory = inventoryResponseSchema.parse(initial.json());
    expect(initial.json()).toEqual(inventory);
    expect(inventory.projects).toEqual([project]);
    expect(initial.headers['cache-control']).toBe('no-store');
    await server.close();
    const restarted = await createServer({ dataDirectory, token });
    try {
      expect(
        (
          await restarted.inject({ method: 'GET', url: '/inventory', headers })
        ).json(),
      ).toEqual(inventory);
      await rename(path, join(root, 'moved'));
      const refreshed = await restarted.inject({
        method: 'POST',
        url: '/inventory/refresh',
        headers,
      });
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json()).toMatchObject({
        environmentId: inventory.environmentId,
        projects: [
          {
            id: project.id,
            available: false,
            worktrees: [{ available: false }],
          },
        ],
      });
    } finally {
      await restarted.close();
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects unauthenticated operations before validation or discovery and sanitizes failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-api-errors-'));
  let calls = 0;
  const server = await createServer({
    dataDirectory: root,
    token,
    git: () => ({
      listWorktrees: async () => {
        calls++;
        throw new Error('private database path and credentials');
      },
    }),
  });
  try {
    for (const [method, url] of [
      ['GET', '/inventory'],
      ['POST', '/projects'],
      ['POST', '/inventory/refresh'],
    ] as const) {
      for (const authorization of [
        '',
        'Bearer wrong',
        `Bearer ${'x'.repeat(token.length)}`,
      ]) {
        const response = await server.inject({
          method,
          url,
          headers: { authorization },
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
    }
    for (const payload of [
      { path: 'relative' },
      { path: '' },
      { path: '/valid', extra: true },
      {},
    ]) {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        headers,
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
      });
    }
    expect(calls).toBe(0);
    const failure = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path: '/fixture' },
    });
    expect(failure.statusCode).toBe(500);
    expect(failure.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Operation failed',
    });
    expect(calls).toBe(1);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('reports an uninspectable checkout without returning Git diagnostics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-api-unavailable-'));
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    token,
  });
  try {
    const response = await server.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { path: root },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      code: 'REPOSITORY_UNAVAILABLE',
      message: 'Repository could not be inspected',
    });
    expect(
      (
        await server.inject({ method: 'GET', url: '/inventory', headers })
      ).json().projects,
    ).toEqual([]);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
