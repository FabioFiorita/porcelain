import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createServer } from './server.ts';

const token = 'fixture-token-with-at-least-32-characters';
async function open(apiDocumentation?: boolean) {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-docs-'));
  onTestFinished(() => rm(dataDirectory, { recursive: true, force: true }));
  const server = await createServer({
    dataDirectory,
    token,
    ...(apiDocumentation === undefined ? {} : { apiDocumentation }),
  });
  onTestFinished(() => server.close());
  return server;
}

describe('API documentation', () => {
  it('requires explicit opt-in before serving the explorer or schema', async () => {
    const server = await open();
    for (const url of ['/documentation/', '/documentation/json'])
      expect((await server.inject({ url })).statusCode).toBe(404);
  });

  it('serves a local explorer with route schemas and the authentication needed to execute requests', async () => {
    const server = await open(true);
    const page = await server.inject({ url: '/documentation/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('swagger-ui');
    const asset = await server.inject({
      url: '/documentation/static/swagger-ui-bundle.js',
    });
    expect(asset.statusCode).toBe(200);
    const response = await server.inject({ url: '/documentation/json' });
    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(document.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
    });
    expect(document.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths['/health'].get.security).toEqual([]);
    expect(
      document.paths['/worktrees/{worktreeId}/comments'].post.requestBody
        .content['application/json'].schema.required,
    ).toEqual(expect.arrayContaining(['anchor', 'body']));
    expect(
      document.paths['/worktrees/{worktreeId}/comments'].post.responses['401'],
    ).toBeDefined();
    expect(response.body).not.toContain(token);
    expect((await server.inject({ url: '/inventory' })).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          url: '/inventory',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(200);
  });
});
