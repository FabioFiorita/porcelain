import { describe, expect, it } from 'vite-plus/test';
import { desktopContentSecurityPolicy } from './content-security-policy.ts';

describe('desktop content security policy', () => {
  it('plays app media, its own blobs and media a file preview inlined', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('media-src ')),
    ).toBe("media-src 'self' data: blob:");
  });

  it('runs no inline script in the built app except the file preview link bridge', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('script-src ')),
    ).toMatch(/^script-src 'self' 'sha256-[A-Za-z0-9+/]{43}='$/);
  });

  it('allows connections to user-entered HTTP and HTTPS computers and their WS and WSS live sockets', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('connect-src ')),
    ).toBe("connect-src 'self' http: https: ws: wss:");
  });

  it('frames only the app and its own blobs, so no frame can show a website inside the window', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('frame-src ')),
    ).toBe("frame-src 'self' blob:");
  });

  it('keeps the remaining directives unchanged, including scripts restricted to the app origin', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .filter(
          (directive) =>
            !directive.startsWith('connect-src ') &&
            !directive.startsWith('frame-src ') &&
            !directive.startsWith('media-src ') &&
            !directive.startsWith('script-src '),
        ),
    ).toEqual([
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ]);
  });

  it('differs for the development web only by admitting the inline script Vite injects for hot reload', () => {
    expect(desktopContentSecurityPolicy('development').split('; ')).toEqual(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .map((directive) =>
          directive.startsWith('script-src ')
            ? "script-src 'self' 'unsafe-inline'"
            : directive,
        ),
    );
    expect(desktopContentSecurityPolicy('development')).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'",
    );
  });
});
