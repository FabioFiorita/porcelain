import { describe, expect, it } from 'vitest';
import type { WaysInCaller } from '../models/ways-in.ts';
import {
  changesRoute,
  protectedRoute,
  waysInFingerprint,
  waysInUnchanged,
} from './ways-in.ts';

const device = (route: WaysInCaller['route'], local = false): WaysInCaller => ({
  viewer: { kind: 'device', deviceId: 'phone' },
  local,
  route,
});

const off = { lan: false, tailnet: false, cloudflare: false };
const home = {
  interfaceName: 'en0',
  subnet: '192.168.1.0/24',
  gateway: '192.168.1.1',
  gatewayHardware: '02:00:5e:10:00:01',
};

describe('protectedRoute', () => {
  it.each([
    [
      'the owner socket',
      { viewer: { kind: 'owner' }, local: false, route: 'lan' },
      undefined,
    ],
    ['a browser on this computer', device('loopback', true), undefined],
    ['a device on the local network', device('lan'), 'lan'],
    ['a device on Tailscale', device('tailnet'), 'tailnet'],
    ['a device through the tunnel', device('tunnel'), 'cloudflare'],
  ] as const)(
    'protects nothing or the way in %s arrived through',
    (_name, caller, route) => {
      expect(protectedRoute(caller)).toBe(route);
    },
  );
});

describe('changesRoute', () => {
  it.each([
    [{ lan: true }, 'lan', true],
    [{ lan: false }, 'lan', true],
    [{ tailnet: true }, 'lan', false],
    [{ tailnet: false }, 'tailnet', true],
    [{ tailnetHostname: 'a.tail0000.ts.net' }, 'tailnet', true],
    [{ cloudflare: true }, 'tailnet', false],
    [{ cloudflare: false }, 'cloudflare', true],
    [{ cloudflareHostname: 'a.example.com' }, 'cloudflare', true],
    [{ lan: true, tailnet: true }, 'cloudflare', false],
    [{ lan: true, cloudflare: false }, undefined, false],
  ] as const)('%o changes %s: %s', (change, route, expected) => {
    expect(changesRoute(change, route)).toBe(expected);
  });
});

describe('waysInFingerprint', () => {
  it('is a stable digest that changes with the settings or the network the computer is on, not with the port Porcelain picks for Tailscale', () => {
    const base = waysInFingerprint(off, home);

    expect(base).toMatch(/^[a-f0-9]{64}$/);
    expect(waysInFingerprint({ ...off }, { ...home })).toBe(base);
    expect(waysInFingerprint({ ...off, lan: true }, home)).not.toBe(base);
    expect(waysInFingerprint({ ...off, tailnetPort: 41000 }, home)).toBe(base);
    expect(
      waysInFingerprint(off, { ...home, gatewayHardware: '02:00:5e:10:00:02' }),
    ).not.toBe(base);
    expect(waysInFingerprint(off, undefined)).not.toBe(base);
  });
});

describe('waysInUnchanged', () => {
  const offStates = {
    lan: { kind: 'off' as const },
    tailnet: { kind: 'off' as const },
    cloudflare: { kind: 'off' as const },
  };

  it('is unchanged only when both the saved settings and every route state stay the same', () => {
    const current = { settings: off, states: offStates };

    expect(waysInUnchanged(current, current, home)).toBe(true);
    expect(
      waysInUnchanged(
        current,
        { settings: { ...off, lan: true }, states: offStates },
        home,
      ),
    ).toBe(false);
    expect(
      waysInUnchanged(
        current,
        {
          settings: off,
          states: { ...offStates, tailnet: { kind: 'starting' } },
        },
        home,
      ),
    ).toBe(false);
  });
});
