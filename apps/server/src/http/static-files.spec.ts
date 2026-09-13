import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  contentTypeForPath,
  registerStaticFiles,
  resolveStaticPath,
} from './static-files.ts';

describe('static web files', () => {
  it('rejects traversal and malformed URL paths before filesystem access', async () => {
    const root = join(tmpdir(), 'porcelain-web-root');
    expect(resolveStaticPath(root, '/../secret')).toBeNull();
    expect(resolveStaticPath(root, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
    expect(resolveStaticPath(root, '/..\\..\\secret')).toBeNull();
    expect(resolveStaticPath(root, '/%zz')).toBeNull();
    expect(resolveStaticPath(root, '/assets/./main.js')).toBe(
      join(root, 'assets', 'main.js'),
    );
  });

  it('serves assets, client routes and safe cache policies without shadowing the API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-web-root-'));
    const server = Fastify();
    try {
      await mkdir(join(root, 'assets'));
      await writeFile(join(root, 'index.html'), '<html>shell</html>');
      await writeFile(join(root, 'assets', 'app-AbCd1234.js'), 'asset');
      await writeFile(join(root, 'styles.css'), 'stable');
      server.get('/api/health', () => ({ status: 'ok' }));
      registerStaticFiles(server, { webRoot: root });

      const shell = await server.inject({ method: 'GET', url: '/' });
      expect(shell.statusCode).toBe(200);
      expect(shell.body).toBe('<html>shell</html>');
      expect(shell.headers['content-type']).toContain('text/html');
      expect(shell.headers['cache-control']).toBe('no-cache');

      const route = await server.inject({
        method: 'GET',
        url: '/review/worktree-1',
      });
      expect(route.statusCode).toBe(200);
      expect(route.body).toBe(shell.body);
      expect(route.headers['cache-control']).toBe('no-cache');

      const hashed = await server.inject({
        method: 'GET',
        url: '/assets/app-AbCd1234.js?v=1',
      });
      expect(hashed.statusCode).toBe(200);
      expect(hashed.body).toBe('asset');
      expect(hashed.headers['content-type']).toContain('text/javascript');
      expect(hashed.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );

      const stable = await server.inject({
        method: 'GET',
        url: '/styles.css',
      });
      expect(stable.statusCode).toBe(200);
      expect(stable.headers['content-type']).toContain('text/css');
      expect(stable.headers['cache-control']).toBe('no-cache');

      const head = await server.inject({ method: 'HEAD', url: '/' });
      expect(head.statusCode).toBe(200);
      expect(head.body).toBe('');
      expect(head.headers['content-length']).toBe(String(shell.body.length));

      const missingAsset = await server.inject({
        method: 'GET',
        url: '/assets/missing.js',
      });
      expect(missingAsset.statusCode).toBe(404);

      const api = await server.inject({ method: 'GET', url: '/api/health' });
      expect(api.statusCode).toBe(200);
      expect(api.json()).toEqual({ status: 'ok' });
      const unknownApi = await server.inject({
        method: 'GET',
        url: '/api/missing-route',
      });
      expect(unknownApi.statusCode).toBe(404);
      expect(unknownApi.body).not.toContain('shell');

      const post = await server.inject({ method: 'POST', url: '/review' });
      expect(post.statusCode).toBe(404);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not follow a symlink out of the configured web root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-web-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'porcelain-web-outside-'));
    const server = Fastify();
    try {
      await writeFile(join(root, 'index.html'), 'shell');
      await writeFile(join(outside, 'secret.txt'), 'secret');
      await symlink(join(outside, 'secret.txt'), join(root, 'secret'));
      registerStaticFiles(server, { webRoot: root });
      const response = await server.inject({
        method: 'GET',
        url: '/secret',
      });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('secret');
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});

it.each([
  ['index.html', 'text/html; charset=utf-8'],
  ['main.js', 'text/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['font.woff2', 'font/woff2'],
  ['icon.svg', 'image/svg+xml'],
  ['unknown.bin', 'application/octet-stream'],
] as const)('maps %s to %s', (path, expected) => {
  expect(contentTypeForPath(path)).toBe(expected);
});
