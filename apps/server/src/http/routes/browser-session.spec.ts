import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { createServer } from '../server.ts';

it('persists browser authentication across restart, requires CSRF headers, and expires sessions', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'browser-session-'));
  const token = 'disposable-browser-session-token-123456';
  const server = await createServer({ dataDirectory, token });
  try {
    const login = await server.inject({
      url: '/inventory',
      headers: {
        authorization: `Bearer ${token}`,
        'x-porcelain-browser': '1',
      },
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).not.toContain(token);
    const headers = {
      cookie: cookie.split(';')[0] ?? '',
      'x-porcelain-browser': '1',
    };
    expect((await server.inject({ url: '/session', headers })).statusCode).toBe(
      200,
    );
    expect(
      (
        await server.inject({
          url: '/inventory',
          headers: { cookie: headers.cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/inventory/refresh',
          headers: { cookie: headers.cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/inventory/refresh',
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          url: '/session',
          headers: {
            ...headers,
            cookie: `${headers.cookie.slice(0, -1)}${headers.cookie.endsWith('a') ? 'b' : 'a'}`,
          },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'DELETE',
          url: '/session',
          headers: { cookie: headers.cookie },
        })
      ).statusCode,
    ).toBe(403);
    const logout = await server.inject({
      method: 'DELETE',
      url: '/session',
      headers,
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    await server.close();
    const restarted = await createServer({ dataDirectory, token });
    try {
      expect(
        (await restarted.inject({ url: '/session', headers })).statusCode,
      ).toBe(200);
      vi.spyOn(Date, 'now').mockReturnValue(
        Date.now() + 31 * 24 * 60 * 60 * 1000,
      );
      expect(
        (await restarted.inject({ url: '/session', headers })).statusCode,
      ).toBe(401);
      vi.restoreAllMocks();
      expect(
        (
          await restarted.inject({
            url: '/inventory',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await restarted.close();
    }
  } finally {
    vi.restoreAllMocks();
    await server.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
