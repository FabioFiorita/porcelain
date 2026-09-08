import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { healthResponseSchema } from '@porcelain/contracts/health';
import { describe, expect, it } from 'vitest';
import { createServer } from './server.ts';

describe('HTTP server', () => {
  it('cancels in-flight discovery before waiting for HTTP requests to finish on shutdown', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-shutdown-'));
    const entered = Promise.withResolvers<void>();
    const server = await createServer({
      dataDirectory,
      token: 'fixture-token-with-at-least-32-characters',
      git: () => ({
        listWorktrees: (signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            });
            entered.resolve();
          }),
      }),
    });
    try {
      const address = await server.listen({ host: '127.0.0.1', port: 0 });
      const response = fetch(`${address}/projects`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer fixture-token-with-at-least-32-characters',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: dataDirectory }),
      });
      await entered.promise;
      await server.close();
      expect((await response).status).toBe(503);
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('serves a validated health response without unauthenticated inventory access or opening a listener', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-http-'));
    try {
      const server = await createServer({
        dataDirectory,
        token: 'fixture-token-with-at-least-32-characters',
      });
      try {
        expect(server.server.listening).toBe(false);
        const response = await server.inject({ method: 'GET', url: '/health' });
        expect(response.statusCode).toBe(200);
        expect(healthResponseSchema.parse(response.json())).toEqual({
          status: 'ok',
        });
        expect(response.json()).toEqual({ status: 'ok' });
        expect(
          (await server.inject({ method: 'GET', url: '/inventory' }))
            .statusCode,
        ).toBe(401);
      } finally {
        await server.close();
      }
      // Application lifecycle releases persistence so it can be opened again.
      const reopened = await createServer({
        dataDirectory,
        token: 'fixture-token-with-at-least-32-characters',
      });
      await reopened.close();
    } finally {
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('responds over a task-owned loopback listener and shuts it down', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-listener-'));
    try {
      const server = await createServer({
        dataDirectory,
        token: 'fixture-token-with-at-least-32-characters',
      });
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
    const dataDirectory = await mkdtemp(
      join(tmpdir(), 'porcelain-serializer-'),
    );
    try {
      const server = await createServer({
        dataDirectory,
        token: 'fixture-token-with-at-least-32-characters',
      });
      try {
        server.get(
          '/fixture',
          { schema: { response: { 200: healthResponseSchema } } },
          () => ({ status: 'ok' as const, privatePath: '/fixture/private' }),
        );
        const response = await server.inject({
          method: 'GET',
          url: '/fixture',
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: 'ok' });
      } finally {
        await server.close();
      }
    } finally {
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('sanitizes failures outside the inventory plugin without treating arbitrary 4xx errors as validation', async () => {
    const dataDirectory = await mkdtemp(
      join(tmpdir(), 'porcelain-root-errors-'),
    );
    const server = await createServer({
      dataDirectory,
      token: 'fixture-token-with-at-least-32-characters',
    });
    try {
      server.get('/failure', async () => {
        throw Object.assign(new Error('private internal details'), {
          statusCode: 401,
        });
      });
      const response = await server.inject({ method: 'GET', url: '/failure' });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Operation failed',
      });
      const unauthorized = await server.inject({
        method: 'GET',
        url: '/inventory',
      });
      expect(unauthorized.statusCode).toBe(401);
      expect(unauthorized.headers['www-authenticate']).toBe('Bearer');
      expect(unauthorized.json()).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  it('maps malformed authenticated JSON to a safe invalid request', async () => {
    const dataDirectory = await mkdtemp(
      join(tmpdir(), 'porcelain-json-errors-'),
    );
    const token = 'fixture-token-with-at-least-32-characters';
    const server = await createServer({ dataDirectory, token });
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: '{"path": private',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Invalid request',
      });
    } finally {
      await server.close();
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });
});
