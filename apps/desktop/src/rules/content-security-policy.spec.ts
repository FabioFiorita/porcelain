import { describe, expect, it } from 'vitest';
import {
  desktopContentSecurityPolicy,
  desktopResponseContentSecurityPolicy,
  summaryContentSecurityPolicy,
} from './content-security-policy.ts';

describe('desktop content security policy', () => {
  it('allows connections to user-entered HTTP and HTTPS computers and their WS and WSS live sockets', () => {
    expect(
      desktopContentSecurityPolicy()
        .split('; ')
        .find((directive) => directive.startsWith('connect-src ')),
    ).toBe("connect-src 'self' http: https: ws: wss:");
  });

  it('frames only the app and its own blobs, so no frame can show a website inside the window', () => {
    expect(
      desktopContentSecurityPolicy()
        .split('; ')
        .find((directive) => directive.startsWith('frame-src ')),
    ).toBe("frame-src 'self' blob:");
  });

  it('keeps the remaining directives unchanged, including scripts restricted to the app origin', () => {
    expect(
      desktopContentSecurityPolicy()
        .split('; ')
        .filter(
          (directive) =>
            !directive.startsWith('connect-src ') &&
            !directive.startsWith('frame-src '),
        ),
    ).toEqual([
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ]);
  });
});

describe('desktop response content security policy', () => {
  const sandbox = 'sandbox allow-scripts allow-forms allow-popups allow-modals';

  it('preserves the server sandbox for a signed review summary page', () => {
    expect(
      desktopResponseContentSecurityPolicy('/review-summaries/token', sandbox),
    ).toBe(sandbox);
  });

  it('applies the app policy to all other pages even when the server supplies another policy', () => {
    expect([
      desktopResponseContentSecurityPolicy('/', sandbox),
      desktopResponseContentSecurityPolicy('/remotes/computer', sandbox),
      desktopResponseContentSecurityPolicy('/review-summaries/', sandbox),
      desktopResponseContentSecurityPolicy(
        '/review-summaries/token/other',
        sandbox,
      ),
    ]).toEqual(Array(4).fill(desktopContentSecurityPolicy()));
  });

  it('keeps the restrictive app policy when a summary has no server policy', () => {
    expect(
      desktopResponseContentSecurityPolicy('/review-summaries/token', null),
    ).toBe(desktopContentSecurityPolicy());
  });
});

describe('summary content security policy', () => {
  it('sandboxes a summary into an opaque origin that may run its own scripts, forms, popups and dialogs', () => {
    expect(summaryContentSecurityPolicy()).toBe(
      'sandbox allow-scripts allow-forms allow-popups allow-modals',
    );
  });
});
