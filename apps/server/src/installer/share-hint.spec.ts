import { describe, expect, it } from 'vitest';
import { localNetworkHint } from './share-hint.ts';

describe('localNetworkHint', () => {
  it.each([
    ['a local network address', '192.0.2.10'],
    ['every address', '0.0.0.0'],
    ['a host name', 'home-server.local'],
  ])(
    'tells the owner to share on the local network again when the service listened on %s',
    (_, host) => {
      expect(localNetworkHint(host)).toBe(
        `The service now listens on this computer only, no longer on ${host}. Share it on the local network again with: porcelain share lan on`,
      );
    },
  );

  it.each([
    ['no saved host', undefined],
    ['the IPv4 loopback address', '127.0.0.1'],
    ['another IPv4 loopback address', '127.0.1.1'],
    ['the IPv6 loopback address', '::1'],
    ['localhost', 'LocalHost'],
  ])('says nothing when the service listened on %s', (_, host) => {
    expect(localNetworkHint(host)).toBeUndefined();
  });
});
