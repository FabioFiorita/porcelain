import { describe, expect, it } from 'vitest';
import {
  appRequestRefusal,
  appRequestTarget,
  forwardedRequestHeaders,
  forwardedResponseHeaders,
} from './app-request.ts';

const server = {
  address: 'http://127.0.0.1:4321',
  credential: 'test-only-desktop-credential',
};

describe('appRequestRefusal', () => {
  it('admits a navigation of the app document, which carries no Origin header', () => {
    expect(
      appRequestRefusal({
        url: 'porcelain://app/project/worktree',
        origin: null,
        initiatorOrigin: undefined,
      }),
    ).toBeUndefined();
  });

  it('admits a request the app document makes', () => {
    expect(
      appRequestRefusal({
        url: 'porcelain://app/api/inventory',
        origin: 'porcelain://app',
        initiatorOrigin: 'porcelain://app',
      }),
    ).toBeUndefined();
  });

  it.each([
    'porcelain://elsewhere/api/inventory',
    'porcelain://app.evil/api/inventory',
    'porcelain://owner:secret@app/api/inventory',
  ])('refuses a request for another desktop authority: %s', (url) => {
    expect(
      appRequestRefusal({ url, origin: null, initiatorOrigin: undefined }),
    ).toBe('Unknown desktop origin');
  });

  it.each(['null', 'https://evil.example', 'porcelain://elsewhere'])(
    'refuses a request whose Origin is opaque or foreign: %s',
    (origin) => {
      expect(
        appRequestRefusal({
          url: 'porcelain://app/api/inventory',
          origin,
          initiatorOrigin: 'porcelain://app',
        }),
      ).toBe('Unknown desktop origin');
    },
  );

  it.each(['null', 'https://evil.example', 'http://127.0.0.1:4321'])(
    'refuses a navigation a sandboxed or foreign document starts even without an Origin header: %s',
    (initiatorOrigin) => {
      expect(
        appRequestRefusal({
          url: 'porcelain://app/',
          origin: null,
          initiatorOrigin,
        }),
      ).toBe('Unknown desktop initiator');
    },
  );
});

describe('appRequestTarget', () => {
  it('sends the path and query to the local server and leaves the fragment behind', () => {
    expect(
      appRequestTarget(
        'porcelain://app/api/files?path=README.md#line-2',
        server.address,
      ),
    ).toBe('http://127.0.0.1:4321/api/files?path=README.md');
  });

  it.each([
    'porcelain://app//evil.example/api/inventory',
    'porcelain://app/\\evil.example/api/inventory',
  ])(
    'never leaves the server origin for a path that reads as another host: %s',
    (url) => {
      expect(appRequestTarget(url, server.address)).toBeUndefined();
    },
  );
});

describe('forwardedRequestHeaders', () => {
  const forwarded = forwardedRequestHeaders(
    new Headers({
      host: 'app',
      cookie: 'porcelain_device=stolen',
      connection: 'keep-alive',
      'content-length': '12',
      'accept-encoding': 'gzip',
      authorization: 'Bearer page-supplied',
      origin: 'porcelain://app',
      'content-type': 'application/json',
    }),
    server,
  );

  it('withholds the host, cookies, connection, length and encoding the page sent', () => {
    expect(
      ['host', 'cookie', 'connection', 'content-length', 'accept-encoding'].map(
        (name) => forwarded.get(name),
      ),
    ).toEqual([null, null, null, null, null]);
  });

  it('replaces any authorization the page sent with the app credential', () => {
    expect(forwarded.get('authorization')).toBe(
      'Bearer test-only-desktop-credential',
    );
  });

  it('presents the server its own origin and keeps the content type', () => {
    expect([forwarded.get('origin'), forwarded.get('content-type')]).toEqual([
      'http://127.0.0.1:4321',
      'application/json',
    ]);
  });
});

describe('forwardedResponseHeaders', () => {
  const answer = new Headers({
    'set-cookie': 'porcelain_device=issued',
    'content-encoding': 'gzip',
    'content-length': '12',
    'content-type': 'text/html',
    'content-security-policy': "default-src 'none'",
  });

  it('withholds cookies, encoding and length from the page and keeps the content type', () => {
    const forwarded = forwardedResponseHeaders('/', answer);
    expect(
      ['set-cookie', 'content-encoding', 'content-length', 'content-type'].map(
        (name) => forwarded.get(name),
      ),
    ).toEqual([null, null, null, 'text/html']);
  });

  it('gives every page the app policy, which keeps scripts to the app, instead of the server one', () => {
    expect(
      forwardedResponseHeaders('/project/worktree', answer)
        .get('content-security-policy')
        ?.split('; '),
    ).toContain("script-src 'self'");
  });

  it('leaves the policy of an API answer as the server sent it', () => {
    expect(
      forwardedResponseHeaders('/api/inventory', answer).get(
        'content-security-policy',
      ),
    ).toBe("default-src 'none'");
  });
});
