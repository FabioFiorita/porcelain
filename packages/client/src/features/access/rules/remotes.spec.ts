import { Redacted } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  remoteStatus,
  remoteStatusNote,
  parseRemotes,
  withRemote,
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
  it('replaces a remote paired again instead of listing it twice', () => {
    const renewed = { ...remote, credential: Redacted.make('pcd_new') };
    expect(withRemote([remote], renewed)).toEqual([renewed]);
  });
});
