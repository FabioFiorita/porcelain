import { describe, expect, it } from 'vitest';
import {
  canonicalHostname,
  hostnameAllowed,
  pairingAddressReachable,
  reachableAt,
} from './host-policy.ts';

const nothingConfigured = { allowedHosts: [], localAddresses: [] };

describe('canonicalHostname', () => {
  it('lowercases a name and drops its trailing dot', () => {
    expect(canonicalHostname('Porcelain.Example.')).toBe('porcelain.example');
  });

  it('unwraps a bracketed IPv6 address and writes it in its shortest form', () => {
    expect(canonicalHostname('[0:0:0:0:0:0:0:1]')).toBe('::1');
  });

  it('reads an IPv4-mapped IPv6 address as the IPv4 address it carries', () => {
    expect(canonicalHostname('::ffff:192.168.1.20')).toBe('192.168.1.20');
    expect(canonicalHostname('[::ffff:c0a8:114]')).toBe('192.168.1.20');
  });

  it('has no canonical form for an empty or malformed address', () => {
    expect(canonicalHostname('')).toBeUndefined();
    expect(canonicalHostname('[]')).toBeUndefined();
    expect(canonicalHostname('fe80::1%eth0')).toBeUndefined();
    expect(canonicalHostname('1::2::3')).toBeUndefined();
  });
});

describe('hostnameAllowed', () => {
  it.each(['localhost', '::1', '127.0.0.1', '127.8.9.10'])(
    'always allows the loopback name or address %s',
    (hostname) => {
      expect(hostnameAllowed(hostname, nothingConfigured)).toBe(true);
    },
  );

  it('refuses a name that only starts like a loopback address', () => {
    expect(
      hostnameAllowed('127.0.0.1.attacker.example', nothingConfigured),
    ).toBe(false);
  });

  it('allows configured hosts and local addresses in any spelling', () => {
    const policy = {
      allowedHosts: ['Laptop.Local.'],
      localAddresses: ['::ffff:10.0.0.5'],
    };
    expect(hostnameAllowed('laptop.local', policy)).toBe(true);
    expect(hostnameAllowed('10.0.0.5', policy)).toBe(true);
    expect(hostnameAllowed('10.0.0.6', policy)).toBe(false);
  });
});

describe('reachableAt', () => {
  it('does not treat loopback as reachable unless the server listens there', () => {
    expect(reachableAt('localhost', nothingConfigured)).toBe(false);
    expect(reachableAt('127.0.0.1', nothingConfigured)).toBe(false);
  });

  it('reaches localhost when the server listens on a loopback address', () => {
    expect(
      reachableAt('localhost', { allowedHosts: [], localAddresses: ['::1'] }),
    ).toBe(true);
  });

  it('reaches configured hosts and local addresses only', () => {
    const policy = {
      allowedHosts: ['porcelain.example'],
      localAddresses: ['192.168.1.20'],
    };
    expect(reachableAt('porcelain.example', policy)).toBe(true);
    expect(reachableAt('192.168.1.20', policy)).toBe(true);
    expect(reachableAt('192.168.1.21', policy)).toBe(false);
  });
});

describe('pairingAddressReachable', () => {
  const reach = {
    port: 4173,
    policy: { allowedHosts: [], localAddresses: ['192.168.1.20'] },
  };

  it('accepts an http or https address on the listening port', () => {
    expect(pairingAddressReachable('http://192.168.1.20:4173', reach)).toBe(
      true,
    );
    expect(pairingAddressReachable('https://192.168.1.20:4173/', reach)).toBe(
      true,
    );
  });

  it('refuses an address on another port, including the default one', () => {
    expect(pairingAddressReachable('http://192.168.1.20:4174', reach)).toBe(
      false,
    );
    expect(pairingAddressReachable('http://192.168.1.20', reach)).toBe(false);
  });

  it('uses the scheme default port when the address names none', () => {
    expect(
      pairingAddressReachable('https://192.168.1.20', { ...reach, port: 443 }),
    ).toBe(true);
    expect(
      pairingAddressReachable('http://192.168.1.20', { ...reach, port: 80 }),
    ).toBe(true);
  });

  it('refuses other schemes, unknown hosts and text that is not a URL', () => {
    expect(pairingAddressReachable('ftp://192.168.1.20:4173', reach)).toBe(
      false,
    );
    expect(pairingAddressReachable('http://10.0.0.1:4173', reach)).toBe(false);
    expect(pairingAddressReachable('192.168.1.20:4173', reach)).toBe(false);
  });
});
