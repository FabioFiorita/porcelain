import { Redacted } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  remoteStatus,
  remoteStatusNote,
  parseRemotes,
  withRemote,
  serializeRemotes,
  operationJournalKey,
  connectionRoutes,
  connectionRouteTitle,
  withConnectionRoutes,
} from './remotes.ts';
const environmentId = '1bc3e6b1-f849-4176-93b2-850147d4ebb3';
const remote = {
  environmentId,
  name: 'home-server',
  address: 'http://192.0.2.10:4738',
  credential: Redacted.make('pcd_secret'),
};
const environment = {
  environmentId,
  name: 'home-server',
  version: '1.2.0',
  protocol: 2,
};

describe('remoteStatus', () => {
  it.each([
    [undefined, { kind: 'checking' }],
    [{ kind: 'unauthorized' as const }, { kind: 'needs-pairing' }],
    [{ kind: 'unreachable' as const }, { kind: 'offline' }],
    [
      { kind: 'described' as const, environment },
      { kind: 'online', name: 'home-server', version: '1.2.0' },
    ],
    [
      {
        kind: 'described' as const,
        environment: { ...environment, environmentId: 'another' },
      },
      { kind: 'other-server' },
    ],
    [
      {
        kind: 'described' as const,
        environment: { ...environment, protocol: 1 },
      },
      { kind: 'incompatible' },
    ],
  ])('turns the answer %j into %j', (answer, status) => {
    expect(remoteStatus(remote, answer)).toEqual(status);
  });
});

describe('remoteStatusNote', () => {
  it('explains each unusable remote without naming the kind of device reading it', () => {
    expect(
      (
        [
          { kind: 'offline' },
          { kind: 'needs-pairing' },
          { kind: 'other-server' },
          { kind: 'incompatible' },
        ] as const
      ).map(remoteStatusNote),
    ).toEqual([
      'It did not answer. Check that it runs and that this device reaches its address.',
      'It no longer accepts this app. Run porcelain pair on it and add the new link.',
      'Another Porcelain answers at this address now, so this app stays away from it.',
      'It runs a Porcelain this app cannot talk to. Update both to the same version.',
    ]);
  });

  it('adds nothing while checking or once the remote answers', () => {
    expect([
      remoteStatusNote({ kind: 'checking' }),
      remoteStatusNote({ kind: 'online', name: 'home-server' }),
    ]).toEqual([undefined, undefined]);
  });
});

describe('parseRemotes', () => {
  it('keeps the saved remotes that are complete and drops the rest', () => {
    expect(
      parseRemotes([
        { ...remote, credential: 'pcd_secret' },
        { ...remote, credential: '' },
        'junk',
        null,
      ]),
    ).toEqual([remote]);
  });

  it('reads nothing from a value that is not a list', () => {
    expect(parseRemotes({ remotes: [remote] })).toEqual([]);
  });
});

describe('withRemote', () => {
  it('keeps the LAN pairing when a second route pairs to the same computer', () => {
    const tailnet = {
      ...remote,
      address: 'https://server.example.ts.net',
      credential: Redacted.make('tailnet-secret'),
      deviceId: 'tailnet-device',
    };
    expect(withRemote([remote], tailnet)).toEqual([
      {
        ...remote,
        alternateRoutes: [
          {
            address: tailnet.address,
            credential: tailnet.credential,
            deviceId: tailnet.deviceId,
          },
        ],
      },
    ]);
  });
  it('replaces a remote paired again instead of listing it twice', () => {
    const renewed = { ...remote, credential: Redacted.make('pcd_new') };
    expect(withRemote([remote], renewed)).toEqual([renewed]);
  });
});

it('restores both route credentials and preference after serialization, including legacy single-route data', () => {
  const tailnet = {
    ...remote,
    address: 'https://development.example.ts.net',
    credential: Redacted.make('tailnet-secret'),
  };
  const saved = withRemote([remote], tailnet);
  expect(parseRemotes(JSON.parse(serializeRemotes(saved)))).toEqual(saved);
  expect(parseRemotes(JSON.parse(serializeRemotes([remote])))).toEqual([
    remote,
  ]);
});

it('orders saved connections and labels LAN and Tailscale addresses', () => {
  const alternative = {
    address: 'https://development.example.ts.net',
    credential: Redacted.make('tailnet-secret'),
  };
  const saved = { ...remote, alternateRoutes: [alternative] };
  expect(connectionRoutes(saved).map((route) => route.address)).toEqual([
    remote.address,
    alternative.address,
  ]);
  expect(connectionRouteTitle('http://192.168.1.2:4738')).toBe('LAN');
  expect(connectionRouteTitle(alternative.address)).toBe('Tailscale');
  expect(connectionRouteTitle('https://development.example.com')).toBe(
    'Network',
  );
  expect(withConnectionRoutes(saved, [alternative, remote])).toEqual({
    environmentId,
    name: remote.name,
    ...alternative,
    alternateRoutes: [
      { address: remote.address, credential: remote.credential },
    ],
  });
});

it('keeps the legacy Git journal identity when the preferred connection changes or is removed', () => {
  const original = { ...remote, deviceId: 'lan-device' };
  const tailnet = {
    address: 'https://development.example.ts.net',
    credential: Redacted.make('tailnet-secret'),
    deviceId: 'tailnet-device',
  };
  const expected = JSON.stringify([
    environmentId,
    original.address,
    'lan-device',
  ]);
  expect(operationJournalKey(original)).toBe(expected);
  const preferred = withConnectionRoutes(original, [tailnet, original]);
  expect(operationJournalKey(preferred)).toBe(expected);
  const removed = withConnectionRoutes(preferred, [original]);
  expect(operationJournalKey(removed)).toBe(expected);
  expect(
    operationJournalKey(
      parseRemotes(JSON.parse(serializeRemotes([preferred])))[0]!,
    ),
  ).toBe(expected);
});
