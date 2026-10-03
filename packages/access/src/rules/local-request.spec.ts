import { describe, expect, it } from 'vitest';
import type { CheckLocalRequestInput } from '@porcelain/access/models';
import { localRequest } from './local-request.ts';

function request(extra: Partial<CheckLocalRequestInput> = {}) {
  return localRequest({
    host: '127.0.0.1:4173',
    route: 'loopback',
    remoteAddress: '127.0.0.1',
    localAddress: '127.0.0.1',
    headers: ['host', 'accept'],
    ...extra,
  });
}

describe('localRequest', () => {
  it.each(['127.0.0.1:4173', 'localhost:4173', '[::1]:4173'])(
    'is local when a loopback client asks the loopback listener for %s',
    (host) => {
      expect(request({ host })).toBe(true);
    },
  );

  it('reads an IPv4-mapped loopback socket address as loopback', () => {
    expect(
      request({
        remoteAddress: '::ffff:127.0.0.1',
        localAddress: '::ffff:127.0.0.1',
      }),
    ).toBe(true);
  });

  it.each(['tailnet', 'tunnel', 'lan'] as const)(
    'is not local when it came over the %s route, even with loopback addresses, a loopback host and no forwarding header',
    (route) => {
      expect(request({ route })).toBe(false);
    },
  );

  it('is not local when the request names a public hostname, as one relayed by a tunnel does', () => {
    expect(request({ host: 'porcelain.example.com' })).toBe(false);
  });

  it('is not local when it arrived on a network listener', () => {
    expect(
      request({
        host: '192.168.1.20:4173',
        localAddress: '192.168.1.20',
        remoteAddress: '192.168.1.30',
      }),
    ).toBe(false);
  });

  it('is not local when a loopback host name arrives from another machine', () => {
    expect(request({ remoteAddress: '192.168.1.30' })).toBe(false);
  });

  it.each([
    'Forwarded',
    'x-forwarded-for',
    'X-Real-IP',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-host',
  ])(
    'is not local when a proxy on this machine relayed it with %s',
    (header) => {
      expect(request({ headers: ['host', header] })).toBe(false);
    },
  );

  it('is not local without a readable Host header', () => {
    expect(request({ host: undefined })).toBe(false);
    expect(request({ host: 'local\0host' })).toBe(false);
  });

  it('is local when the host browser names its own loopback page as origin and referrer', () => {
    expect(
      request({
        origin: 'http://127.0.0.1:4173',
        referer: 'http://127.0.0.1:4173/settings/sharing',
        fetchSite: 'same-origin',
      }),
    ).toBe(true);
  });

  it.each([
    ['a tunnel page', 'https://porcelain.example.com'],
    ['a page on the local network', 'http://192.168.1.20:4173'],
    ['a loopback page of another server', 'http://127.0.0.1:5173'],
    ['a loopback page over another scheme', 'https://127.0.0.1:4173'],
    ['an opaque origin', 'null'],
    ['an unreadable origin', 'not an origin'],
  ])(
    'is not local when a browser sent it from %s, as one a proxy on this machine relayed without saying so',
    (_page, origin) => {
      expect(request({ origin })).toBe(false);
    },
  );

  it('is not local when the browser page that asked is elsewhere', () => {
    expect(
      request({ referer: 'https://porcelain.example.com/settings/sharing' }),
    ).toBe(false);
  });

  it.each(['cross-site', 'same-site', 'none'])(
    'is not local when the browser says the request is %s',
    (fetchSite) => {
      expect(request({ fetchSite })).toBe(false);
    },
  );
});
