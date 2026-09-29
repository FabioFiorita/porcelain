import { describe, expect, it } from 'vitest';
import type { CheckLocalRequestInput } from '@porcelain/access/models';
import { localRequest } from './local-request.ts';

function request(extra: Partial<CheckLocalRequestInput> = {}) {
  return localRequest({
    host: '127.0.0.1:4173',
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
});
