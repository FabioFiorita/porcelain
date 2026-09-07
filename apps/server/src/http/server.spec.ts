import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { healthResponseSchema } from '@porcelain/contracts/health';
import { expect, it } from 'vitest';
import { createServer } from './server.ts';

it('serves a validated health response without exposing inventory or opening a listener', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-http-'));
  try {
    const server = await createServer({ dataDirectory });
    try {
      expect(server.server.listening).toBe(false);
      const response = await server.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(healthResponseSchema.parse(response.json())).toEqual({
        status: 'ok',
      });
      expect(response.json()).toEqual({ status: 'ok' });
      expect(
        (await server.inject({ method: 'GET', url: '/inventory' })).statusCode,
      ).toBe(404);
    } finally {
      await server.close();
    }
    // Application lifecycle releases persistence so it can be opened again.
    const reopened = await createServer({ dataDirectory });
    await reopened.close();
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

it('responds over a task-owned loopback listener and shuts it down', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-listener-'));
  try {
    const server = await createServer({ dataDirectory });
    try {
      const address = await server.listen({ host: '127.0.0.1', port: 0 });
      const response = await fetch(`${address}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    } finally {
      await server.close();
    }
    expect(server.server.listening).toBe(false);
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

it('uses the Zod response serializer to remove undeclared fields', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-serializer-'));
  try {
    const server = await createServer({ dataDirectory });
    try {
      server.get(
        '/fixture',
        { schema: { response: { 200: healthResponseSchema } } },
        () => ({ status: 'ok' as const, privatePath: '/fixture/private' }),
      );
      const response = await server.inject({ method: 'GET', url: '/fixture' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await server.close();
    }
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
