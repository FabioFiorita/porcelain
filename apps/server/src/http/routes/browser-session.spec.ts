import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { pairBrowser, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

const ninetyDays = 90 * 24 * 60 * 60;

it('keeps the browser on its paired device cookie across restart, and lets it disconnect', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'browser-session-'));
  const server = await createServer({
    pairingReach,
    dataDirectory,
    projectHome: dataDirectory,
  });
  try {
    const { cookie, setCookie } = await pairBrowser(server, server.application);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/api');
    expect(setCookie).toContain(`Max-Age=${ninetyDays}`);

    // The cookie is the whole credential. There is no browser header to also
    // present: SameSite=Strict keeps it off cross-site requests, and the
    // origin check refuses a foreign writer.
    expect(
      (await server.inject({ url: '/api/session', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/inventory/refresh',
          headers: { cookie, 'x-porcelain-browser': '1' },
        })
      ).statusCode,
    ).toBe(200);

    // One changed character is a different credential, and no credential.
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('a') ? 'b' : 'a'}`;
    expect(
      (
        await server.inject({
          url: '/api/session',
          headers: { cookie: tampered },
        })
      ).statusCode,
    ).toBe(401);

    // A device that survives a restart is a device the store owns, not one a
    // process remembered.
    await server.close();
    const restarted = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    try {
      expect(
        (await restarted.inject({ url: '/api/session', headers: { cookie } }))
          .statusCode,
      ).toBe(200);

      // Disconnect needs the browser's own header, so a plain navigation
      // cannot log the owner out.
      expect(
        (
          await restarted.inject({
            method: 'DELETE',
            url: '/api/session',
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(403);
      const disconnected = await restarted.inject({
        method: 'DELETE',
        url: '/api/session',
        headers: { cookie, 'x-porcelain-browser': '1' },
      });
      expect(disconnected.statusCode).toBe(204);
      const cleared = String(disconnected.headers['set-cookie']);
      expect(cleared).toContain('porcelain_device=;');
      expect(cleared).toContain('Max-Age=0');

      // Disconnect takes the credential away from this browser, not from the
      // installation: the device stays paired until the owner revokes it.
      expect(
        (await restarted.inject({ url: '/api/session', headers: { cookie } }))
          .statusCode,
      ).toBe(200);
    } finally {
      await restarted.close();
    }

    // Ninety days without a single request, and the credential is gone. The
    // clock moves before the server opens, because a server reads the time
    // once and keeps that reader for its whole life.
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.now() + (ninetyDays + 24 * 60 * 60) * 1000,
    );
    const later = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    try {
      expect(
        (await later.inject({ url: '/api/session', headers: { cookie } }))
          .statusCode,
      ).toBe(401);
    } finally {
      vi.restoreAllMocks();
      await later.close();
    }
  } finally {
    vi.restoreAllMocks();
    await server.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
