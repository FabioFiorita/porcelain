import { readRemoteAccessResponseSchema } from '@porcelain/contracts/access';
import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  hostnameForm,
  LOCAL_NETWORK_WARNING,
  localNetworkNote,
  protectedRouteNote,
  remoteRouteDescriptions,
  remoteRouteNames,
  routeFailure,
  routeStatusLabel,
  tailscaleServeCommand,
  ANDROID_EMULATOR_HOST,
  waysInPermissionShown,
  waysInRefusal,
  type RemoteAccess,
} from './share.ts';

const home = {
  interfaceName: 'wlp2s0',
  subnet: '192.168.1.0/24',
  gateway: '192.168.1.1',
  gatewayHardware: 'a4:91:b1:0c:7e:11',
};
const cafe = {
  interfaceName: 'wlp2s0',
  subnet: '10.20.0.0/16',
  gateway: '10.20.0.1',
  gatewayHardware: '10:20:30:40:50:60',
};

function remote(
  lan: RemoteAccess['routes']['lan'],
  networks: Pick<RemoteAccess, 'lanNetwork' | 'localNetwork'>,
): RemoteAccess {
  const off = { enabled: false, status: { kind: 'off' as const } };
  return {
    routes: { lan, tailnet: off, cloudflare: off },
    ...networks,
    serviceUrl: 'http://127.0.0.1:4173',
    editing: Schema.decodeUnknownSync(
      readRemoteAccessResponseSchema.fields.editing,
    )({ fingerprint: 'a'.repeat(64) }),
  };
}

const paused = { enabled: true, status: { kind: 'paused' as const } };

describe('localNetworkNote', () => {
  it('names the one network turning the local network on would listen on', () => {
    expect(
      localNetworkNote(
        remote(
          { enabled: false, status: { kind: 'off' } },
          { localNetwork: home },
        ),
      ),
    ).toBe(
      'Turning it on listens on 192.168.1.0/24 on wlp2s0 only, and pauses on any other network.',
    );
  });

  it('says there is nothing to turn on while the computer is on no local network', () => {
    expect(
      localNetworkNote(remote({ enabled: false, status: { kind: 'off' } }, {})),
    ).toBe('This computer is not on a local network right now.');
  });

  it('names the network it listens on', () => {
    expect(
      localNetworkNote(
        remote(
          {
            enabled: true,
            status: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
          },
          { lanNetwork: home, localNetwork: home },
        ),
      ),
    ).toBe('Listening on 192.168.1.0/24 on wlp2s0 only.');
  });

  it('explains a pause on another network and where it listens again', () => {
    expect(
      localNetworkNote(
        remote(paused, { lanNetwork: home, localNetwork: cafe }),
      ),
    ).toBe(
      'Paused on this network. It was turned on for 192.168.1.0/24 on wlp2s0, and listens again there, or here once you turn it on for this network.',
    );
  });

  it('explains a pause while the computer is on no local network', () => {
    expect(localNetworkNote(remote(paused, { lanNetwork: home }))).toBe(
      'Paused: this computer is not on a local network. Porcelain listens again when it is back on 192.168.1.0/24 on wlp2s0.',
    );
  });

  it('explains the pause of a local network turned on before its network was kept', () => {
    expect(localNetworkNote(remote(paused, { localNetwork: cafe }))).toBe(
      'Paused on this network. It was turned on before Porcelain kept the network it was turned on for; turn it on for this network to listen here.',
    );
  });

  it('explains a pause on a network that looks like its own but has another router', () => {
    expect(
      localNetworkNote(
        remote(paused, {
          lanNetwork: home,
          localNetwork: { ...home, gatewayHardware: '10:20:30:40:50:60' },
        }),
      ),
    ).toBe(
      'Paused on this network. It looks like 192.168.1.0/24 on wlp2s0, but its router is another one, so this is another network; turn it on for this network to listen here.',
    );
  });

  it('explains a pause while the router of this network cannot be identified', () => {
    const { gatewayHardware: _, ...unknownRouter } = home;
    expect(
      localNetworkNote(
        remote(paused, { lanNetwork: home, localNetwork: unknownRouter }),
      ),
    ).toBe(
      'Paused. Porcelain cannot tell this network from another one yet, because the hardware address of its router is not known.',
    );
  });

  it('says why it cannot be turned on while the router of this network cannot be identified', () => {
    const { gatewayHardware: _, ...unknownRouter } = home;
    expect(
      localNetworkNote(
        remote(
          { enabled: false, status: { kind: 'off' } },
          { localNetwork: unknownRouter },
        ),
      ),
    ).toBe(
      'Porcelain cannot tell this network from another one yet, because the hardware address of its router is not known. Try again in a moment.',
    );
  });
});

describe('tailscaleServeCommand', () => {
  it('forwards HTTPS on the Tailscale name to the listener Porcelain keeps for it', () => {
    expect(tailscaleServeCommand('http://127.0.0.1:41000')).toBe(
      'tailscale serve --bg --https=443 http://127.0.0.1:41000',
    );
  });
});

describe('routeFailure', () => {
  it('tells the owner what to set up in Tailscale when nothing answers at its name, not what to check in cloudflared', () => {
    expect(routeFailure('tailnet', 'unreachable')).toContain(
      'you ran the command below',
    );
    expect(routeFailure('cloudflare', 'unreachable')).toContain('cloudflared');
  });
});

it('orders the ways in from the nearest network to the public tunnel', () => {
  expect(remoteRouteNames).toEqual(['lan', 'tailnet', 'cloudflare']);
});

describe('routeStatusLabel', () => {
  it.each([
    ['lan', { enabled: false, status: { kind: 'off' } }, null],
    ['lan', { enabled: true, status: { kind: 'off' } }, 'Starting'],
    ['lan', { enabled: true, status: { kind: 'starting' } }, 'Starting'],
    [
      'tailnet',
      { enabled: true, status: { kind: 'starting' } },
      'Checking the Tailscale name',
    ],
    [
      'cloudflare',
      { enabled: true, status: { kind: 'starting' } },
      'Checking the tunnel',
    ],
    [
      'lan',
      { enabled: true, status: { kind: 'paused' } },
      'Paused on this network',
    ],
    [
      'cloudflare',
      { enabled: true, status: { kind: 'failed', reason: 'unreachable' } },
      'Failed',
    ],
    ['lan', { enabled: true, status: { kind: 'on', urls: [] } }, 'On'],
    ['lan', { enabled: false, status: { kind: 'on', urls: [] } }, 'Stopping'],
  ] as const)('labels %s %o as %s', (name, route, label) => {
    expect(routeStatusLabel(name, route)).toBe(label);
  });
});

describe('ways in copy', () => {
  const ownAddress =
    'Ways in cannot be seen or changed over this connection, because it reaches the computer that runs Porcelain through that computer’s own address. Change them on that computer, or pair this device through the local network, Tailscale or a Cloudflare tunnel.';
  const askOwner =
    'This device cannot see or change ways in. An owner can let it in Devices, under Settings → Computers → This computer, in a browser on the computer that runs Porcelain.';

  it.each([
    ['http://127.0.0.1:4173', ownAddress],
    ['http://127.0.1.1:4173', ownAddress],
    ['http://localhost:4173', ownAddress],
    ['http://[::1]:4173', ownAddress],
    ['http://192.168.1.20:4173', askOwner],
    ['https://laptop.tail0000.ts.net', askOwner],
    ['https://porcelain.example.com', askOwner],
    ['http://localhost.:4173', ownAddress],
    ['http://app.localhost:4173', ownAddress],
    ['http://[::ffff:127.0.0.1]:4173', ownAddress],
    ['https://localhost.example.com', askOwner],
    ['https://127.example.com', askOwner],
    ['http://10.0.2.2:4173', askOwner],
  ])('explains a refused ways-in read over %s', (address, note) => {
    expect(waysInRefusal(address)).toBe(note);
  });

  it.each([
    ['http://10.0.2.2:4173', ownAddress],
    ['http://10.0.2.3:4173', askOwner],
  ])(
    'explains a refused ways-in read over %s from an app that reaches its computer through the Android emulator',
    (address, note) => {
      expect(waysInRefusal(address, [ANDROID_EMULATOR_HOST])).toBe(note);
    },
  );

  it.each([
    ['lan', false, true],
    ['tailnet', false, true],
    ['tunnel', false, true],
    ['loopback', false, false],
    ['loopback', true, true],
  ] as const)(
    'shows the can-edit-ways-in switch for a device on %s with the permission %s: %s',
    (route, canEditWaysIn, shown) => {
      expect(
        waysInPermissionShown({
          id: 'phone',
          label: 'Phone',
          platform: 'iOS',
          createdAt: '2026-10-20T10:00:00.000Z',
          lastSeenAt: '2026-10-20T10:00:00.000Z',
          route,
          trusted: false,
          canEditWaysIn,
        }),
      ).toBe(shown);
    },
  );

  it('explains the locked way in by the name a person sees, and where an owner grants the permission', () => {
    expect(protectedRouteNote('cloudflare')).toBe(
      'This device is connected through Cloudflare tunnel, so it cannot change it. Change it on the computer that runs Porcelain, or from a device connected another way.',
    );
    expect(LOCAL_NETWORK_WARNING).toBe(
      'Anyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale.',
    );
    expect(Object.keys(remoteRouteDescriptions)).toEqual([
      'lan',
      'tailnet',
      'cloudflare',
    ]);
  });
});

describe('hostnameForm', () => {
  const off = { enabled: false, status: { kind: 'off' as const } };
  const empty = remote(off, {});
  const saved: RemoteAccess = {
    ...empty,
    routes: {
      ...empty.routes,
      tailnet: {
        enabled: true,
        status: { kind: 'failed', reason: 'unreachable' },
      },
    },
    tailnetHostname: 'laptop.tail0000.ts.net',
    cloudflareHostname: 'porcelain.example.com',
  };

  it('names the field, and turns its route on with the first saved hostname', () => {
    expect(hostnameForm(empty, 'tailnet', ' a.tail0000.ts.net ')).toEqual({
      label: 'Tailscale name',
      saveLabel: 'Save name',
      placeholder: 'laptop.tail1234.ts.net',
      value: ' a.tail0000.ts.net ',
      canSave: true,
      save: { tailnetHostname: 'a.tail0000.ts.net', tailnet: true },
      failed: false,
      check: { tailnet: true },
    });
    expect(hostnameForm(empty, 'cloudflare', 'a.example.com')).toMatchObject({
      label: 'Public hostname',
      saveLabel: 'Save hostname',
      placeholder: 'porcelain.example.com',
      save: { cloudflareHostname: 'a.example.com', cloudflare: true },
      check: { cloudflare: true },
    });
  });

  it('only renames a saved route, offers no save for the saved or an empty name, and offers a check when it failed', () => {
    expect(hostnameForm(saved, 'cloudflare', 'b.example.com')).toMatchObject({
      canSave: true,
      save: { cloudflareHostname: 'b.example.com' },
      failed: false,
    });
    expect(hostnameForm(saved, 'tailnet', null)).toMatchObject({
      value: 'laptop.tail0000.ts.net',
      canSave: false,
      failed: true,
    });
    expect(hostnameForm(saved, 'tailnet', '  ').canSave).toBe(false);
  });
});
