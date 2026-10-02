import { describe, expect, it } from 'vitest';
import {
  parseRemotes,
  remoteLink,
  remoteLiveOpen,
  remoteStatus,
  savedRemotes,
  syncRemoteConnections,
  withRemote,
} from './remotes.ts';

const environmentId = '1bc3e6b1-f849-4176-93b2-850147d4ebb3';
const remote = {
  environmentId,
  name: 'beelink',
  address: 'http://192.168.15.64:4738',
  credential: 'pcd_secret',
};
const environment = {
  environmentId,
  name: 'beelink',
  version: '1.2.0',
  protocol: 1,
};

describe('remoteLink', () => {
  it('reads the address, code and installation from the link porcelain pair prints', () => {
    expect(
      remoteLink(
        ` http://192.168.15.64:4738/pair#c=pcp_code&e=${environmentId} `,
      ),
    ).toEqual({
      address: 'http://192.168.15.64:4738',
      code: 'pcp_code',
      environmentId,
    });
  });

  it.each([
    'not a link',
    'ftp://192.168.15.64/pair#c=a&e=b',
    'http://192.168.15.64:4738/#c=a&e=b',
    'http://192.168.15.64:4738/pair#c=a',
  ])('reads nothing from %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
    expect(
      remoteLink(`http://192.168.15.64:4738/pair#c=a&e=${environmentId}`),
    ).toEqual({
      address: 'http://192.168.15.64:4738',
      code: 'a',
      environmentId,
    });
  });
});

describe('remoteStatus', () => {
  it.each([
    [undefined, { kind: 'checking' }],
    [{ kind: 'unauthorized' as const }, { kind: 'needs-pairing' }],
    [{ kind: 'unreachable' as const }, { kind: 'offline' }],
    [
      { kind: 'described' as const, environment },
      { kind: 'online', name: 'beelink', version: '1.2.0' },
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
        environment: { ...environment, protocol: 2 },
      },
      { kind: 'incompatible' },
    ],
  ])('turns the answer %j into %j', (answer, status) => {
    expect(remoteStatus(remote, answer)).toEqual(status);
  });
});

describe('parseRemotes', () => {
  it('keeps the saved remotes that are complete and drops the rest', () => {
    expect(
      parseRemotes([remote, { ...remote, credential: '' }, 'junk', null]),
    ).toEqual([remote]);
  });

  it('reads nothing from a value that is not a list', () => {
    expect(parseRemotes({ remotes: [remote] })).toEqual([]);
    expect(parseRemotes([remote])).toEqual([remote]);
  });
});

describe('savedRemotes', () => {
  it('reads the remotes saved on this computer', () => {
    expect(
      savedRemotes({ status: 'saved', value: JSON.stringify([remote]) }),
    ).toEqual({ kind: 'readable', remotes: [remote] });
  });

  it('reads an empty store as nothing saved yet, which later saves may fill', () => {
    expect(savedRemotes({ status: 'empty' })).toEqual({
      kind: 'readable',
      remotes: undefined,
    });
  });

  it('reports a store the app could not decrypt as unreadable, with its reason, so nothing saves over it', () => {
    expect(
      savedRemotes({
        status: 'unreadable',
        message: 'The saved credentials could not be read: Keychain denied',
      }),
    ).toEqual({
      kind: 'unreadable',
      message: 'The saved credentials could not be read: Keychain denied',
    });
  });

  it('reports a decrypted store that is not a list it can read as unreadable instead of empty', () => {
    expect(savedRemotes({ status: 'saved', value: '[{"broken"' })).toEqual({
      kind: 'unreadable',
      message: 'The saved remote computers are not in a form this app reads.',
    });
  });
});

describe('withRemote', () => {
  it('replaces a remote paired again instead of listing it twice', () => {
    const renewed = { ...remote, credential: 'pcd_new' };
    expect(withRemote([remote], renewed)).toEqual([renewed]);
  });
});

describe('syncRemoteConnections', () => {
  const open = (saved: typeof remote) => ({ opened: saved.credential });

  it('opens a connection for a remote it has not seen', () => {
    const { next, closed } = syncRemoteConnections([remote], [], open);
    expect(next).toEqual([{ remote, connection: { opened: 'pcd_secret' } }]);
    expect(closed).toEqual([]);
  });

  it('keeps the connection of a remote at the same address with the same credential', () => {
    const kept = { opened: 'pcd_secret' };
    const renamed = { ...remote, name: 'renamed' };
    const { next, closed } = syncRemoteConnections(
      [renamed],
      [{ remote, connection: kept }],
      open,
    );
    expect(next[0]?.connection).toBe(kept);
    expect(next[0]?.remote).toBe(renamed);
    expect(closed).toEqual([]);
  });

  it('closes the connection of a forgotten remote', () => {
    const forgotten = { opened: 'pcd_secret' };
    const { next, closed } = syncRemoteConnections(
      [],
      [{ remote, connection: forgotten }],
      open,
    );
    expect(next).toEqual([]);
    expect(closed).toEqual([forgotten]);
  });

  it.each([
    ['a new credential', { ...remote, credential: 'pcd_new' }],
    ['a new address', { ...remote, address: 'http://192.168.15.65:4738' }],
  ])('replaces the connection of a remote paired with %s', (_, changed) => {
    const old = { opened: 'pcd_secret' };
    const { next, closed } = syncRemoteConnections(
      [changed],
      [{ remote, connection: old }],
      open,
    );
    expect(next[0]?.connection).not.toBe(old);
    expect(next[0]?.connection).toEqual({ opened: changed.credential });
    expect(closed).toEqual([old]);
  });
});

describe('remoteLiveOpen', () => {
  it('opens live updates for an online remote in the desktop app', () => {
    expect(remoteLiveOpen({ kind: 'online', name: 'beelink' }, true)).toBe(
      true,
    );
  });

  it('keeps live updates closed in the web the server serves', () => {
    expect(remoteLiveOpen({ kind: 'online', name: 'beelink' }, false)).toBe(
      false,
    );
  });

  it.each([
    { kind: 'checking' as const },
    { kind: 'offline' as const },
    { kind: 'needs-pairing' as const },
    { kind: 'other-server' as const },
    { kind: 'incompatible' as const },
  ])('keeps live updates closed for a remote that is %j', (status) => {
    expect(remoteLiveOpen(status, true)).toBe(false);
  });
});
