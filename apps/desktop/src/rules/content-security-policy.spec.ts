import { describe, expect, it } from 'vitest';
import { desktopContentSecurityPolicy } from './content-security-policy.ts';

describe('desktop content security policy', () => {
  it('allows connections to user-entered HTTP and HTTPS computers and their WS and WSS live sockets', () => {
    expect(
      desktopContentSecurityPolicy()
        .split('; ')
        .find((directive) => directive.startsWith('connect-src ')),
    ).toBe("connect-src 'self' http: https: ws: wss:");
  });

  it('keeps every other directive unchanged, including scripts restricted to the app origin', () => {
    expect(
      desktopContentSecurityPolicy()
        .split('; ')
        .filter((directive) => !directive.startsWith('connect-src ')),
    ).toEqual([
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "frame-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ]);
  });
});
