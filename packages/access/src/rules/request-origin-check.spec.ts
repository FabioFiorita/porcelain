import { describe, expect, it } from 'vitest';
import type { CheckRequestOriginInput } from '@porcelain/access/models';
import { requestOriginCheck } from './request-origin-check.ts';

function check(request: Partial<CheckRequestOriginInput>) {
  return requestOriginCheck({
    host: '127.0.0.1:4173',
    origin: undefined,
    method: 'GET',
    scheme: 'http',
    localAddress: '127.0.0.1',
    localPort: 4173,
    allowedHosts: [],
    requireSameOrigin: false,
    crossOrigin: 'refused',
    credential: 'none',
    ...request,
  });
}

const sameOrigin = { kind: 'allowed', crossOrigin: false };
const crossOrigin = { kind: 'allowed', crossOrigin: true };

describe('requestOriginCheck', () => {
  it('lets a read through a loopback host without an origin', () => {
    expect(check({})).toEqual(sameOrigin);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['two colons', 'a:b:c'],
    ['an unclosed bracket', '[::1'],
    ['text after the bracket', '[::1]x'],
    ['a port that is not a number', 'localhost:port'],
    ['a NUL byte', 'local\0host'],
  ])('refuses a request whose Host header is %s', (_, host) => {
    expect(check({ host })).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-malformed' },
    });
  });

  it('refuses a host the server was not told to answer to', () => {
    expect(
      check({ host: 'attacker.example:4173', localAddress: '192.168.1.5' }),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: 'attacker.example' },
    });
  });

  it('answers to a configured host and to the address the request reached', () => {
    expect(
      check({ host: 'Laptop.Local.:4173', allowedHosts: ['laptop.local'] }),
    ).toEqual(sameOrigin);
    expect(
      check({ host: '192.168.1.5:4173', localAddress: '::ffff:192.168.1.5' }),
    ).toEqual(sameOrigin);
    expect(check({ host: '[::1]:4173' })).toEqual(sameOrigin);
  });

  it('lets a write without an origin through, as a non-browser client sends it', () => {
    expect(check({ method: 'POST' })).toEqual(sameOrigin);
  });

  it('requires an origin where same origin is demanded, even for a read', () => {
    expect(check({ requireSameOrigin: true })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-required' },
    });
  });

  it('refuses a write from an opaque or malformed origin', () => {
    expect(check({ method: 'POST', origin: 'null' })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-opaque' },
    });
    expect(check({ method: 'POST', origin: 'not a url' })).toEqual({
      kind: 'refused',
      refusal: { kind: 'origin-malformed' },
    });
  });

  it.each([
    ['another scheme', 'https://127.0.0.1:4173'],
    ['another host', 'http://elsewhere.example'],
    ['another port', 'http://127.0.0.1:4174'],
  ])('refuses a write from %s', (_, origin) => {
    expect(check({ method: 'PATCH', origin })).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin },
    });
  });

  it('accepts a write from the same origin, written with or without its default port', () => {
    expect(
      check({
        method: 'DELETE',
        host: 'localhost',
        origin: 'http://localhost:80',
      }),
    ).toEqual(sameOrigin);
    expect(
      check({
        method: 'POST',
        host: '127.0.0.1:4173',
        origin: 'http://127.0.0.1:4173',
      }),
    ).toEqual(sameOrigin);
  });

  it('checks the origin of a read where same origin is demanded', () => {
    expect(
      check({ requireSameOrigin: true, origin: 'http://elsewhere.example' }),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin: 'http://elsewhere.example' },
    });
    expect(
      check({ requireSameOrigin: true, origin: 'http://127.0.0.1:4173' }),
    ).toEqual(sameOrigin);
  });

  it('answers to a tunnel hostname only while it is a tunnel host', () => {
    const host = 'porcelain.example.com';
    expect(check({ host })).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: host },
    });
    expect(
      requestOriginCheck(
        {
          host,
          origin: undefined,
          method: 'GET',
          scheme: 'http',
          localAddress: '127.0.0.1',
          localPort: 4173,
          allowedHosts: [],
          requireSameOrigin: false,
          crossOrigin: 'refused',
          credential: 'none',
        },
        [host],
      ),
    ).toEqual(sameOrigin);
  });

  it('treats a tunnel host as reached over HTTPS, whatever scheme the tunnel spoke to the server', () => {
    const host = 'porcelain.example.com';
    const write = {
      host,
      method: 'POST',
      scheme: 'http',
      localAddress: '127.0.0.1',
      localPort: 4173,
      allowedHosts: [],
      requireSameOrigin: false,
      crossOrigin: 'refused' as const,
      credential: 'none' as const,
    };
    expect(
      requestOriginCheck({ ...write, origin: `https://${host}` }, [host]),
    ).toEqual(sameOrigin);
    expect(
      requestOriginCheck({ ...write, origin: `http://${host}` }, [host]),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin: `http://${host}` },
    });
  });

  it('lets a read from another origin through and says it came from another origin', () => {
    expect(check({ origin: 'http://elsewhere.example' })).toEqual(crossOrigin);
  });

  it.each([
    ['another origin', 'http://elsewhere.example'],
    ['an opaque origin', 'null'],
    ['a malformed origin', 'not a url'],
  ])(
    'lets a write that carries a bearer credential from %s through where bearer clients may cross origins',
    (_, origin) => {
      expect(
        check({
          method: 'POST',
          origin,
          crossOrigin: 'bearer',
          credential: 'bearer',
        }),
      ).toEqual(crossOrigin);
    },
  );

  it('keeps refusing a cross-origin write without a bearer credential where bearer clients may cross origins', () => {
    const origin = 'http://elsewhere.example';
    expect(
      check({
        method: 'POST',
        origin,
        crossOrigin: 'bearer',
        credential: 'none',
      }),
    ).toEqual({ kind: 'refused', refusal: { kind: 'cross-origin', origin } });
    expect(
      check({
        method: 'DELETE',
        origin: 'null',
        crossOrigin: 'bearer',
        credential: 'none',
      }),
    ).toEqual({ kind: 'refused', refusal: { kind: 'origin-opaque' } });
  });

  it('refuses a cross-origin write with a bearer credential where crossing origins is refused', () => {
    const origin = 'http://elsewhere.example';
    expect(
      check({
        method: 'PUT',
        origin,
        crossOrigin: 'refused',
        credential: 'bearer',
      }),
    ).toEqual({ kind: 'refused', refusal: { kind: 'cross-origin', origin } });
  });

  it('refuses a host the server was not told to answer to, even for a bearer client or where anyone may cross origins', () => {
    const request = {
      host: 'rebound.example:4173',
      localAddress: '192.168.1.5',
      method: 'POST',
      origin: 'http://rebound.example:4173',
    };
    const refusal = {
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: 'rebound.example' },
    };
    expect(
      check({ ...request, crossOrigin: 'bearer', credential: 'bearer' }),
    ).toEqual(refusal);
    expect(check({ ...request, crossOrigin: 'anyone' })).toEqual(refusal);
  });

  it('lets anyone write where anyone may cross origins, and says whether the write came from another origin', () => {
    expect(
      check({
        method: 'POST',
        origin: 'http://elsewhere.example',
        crossOrigin: 'anyone',
      }),
    ).toEqual(crossOrigin);
    expect(
      check({ method: 'POST', origin: 'null', crossOrigin: 'anyone' }),
    ).toEqual(crossOrigin);
    expect(
      check({
        method: 'POST',
        origin: 'http://127.0.0.1:4173',
        crossOrigin: 'anyone',
      }),
    ).toEqual(sameOrigin);
    expect(check({ method: 'POST', crossOrigin: 'anyone' })).toEqual(
      sameOrigin,
    );
  });

  it('lets a ticket through from another origin, or without one, where same origin is demanded and tickets may cross origins', () => {
    const upgrade = {
      requireSameOrigin: true,
      crossOrigin: 'ticket' as const,
      credential: 'ticket' as const,
    };
    expect(check({ ...upgrade, origin: 'http://elsewhere.example' })).toEqual(
      crossOrigin,
    );
    expect(check(upgrade)).toEqual(sameOrigin);
  });

  it.each(['bearer', 'none'] as const)(
    'keeps demanding the same origin of an upgrade presenting %s where tickets may cross origins',
    (credential) => {
      const origin = 'http://elsewhere.example';
      const upgrade = {
        requireSameOrigin: true,
        crossOrigin: 'ticket' as const,
        credential,
      };
      expect(check({ ...upgrade, origin })).toEqual({
        kind: 'refused',
        refusal: { kind: 'cross-origin', origin },
      });
      expect(check(upgrade)).toEqual({
        kind: 'refused',
        refusal: { kind: 'origin-required' },
      });
    },
  );

  it('refuses a ticket where only bearer clients may cross origins', () => {
    const origin = 'http://elsewhere.example';
    expect(
      check({
        method: 'POST',
        origin,
        crossOrigin: 'bearer',
        credential: 'ticket',
      }),
    ).toEqual({ kind: 'refused', refusal: { kind: 'cross-origin', origin } });
  });
});
