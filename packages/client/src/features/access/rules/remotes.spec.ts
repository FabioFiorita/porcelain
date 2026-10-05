import { describe, expect, it } from 'vitest';
import {
  remoteStatus,
  parseRemotes,
  withRemote,
  syncRemoteConnections,
} from './remotes.ts';
const environmentId = '1bc3e6b1-f849-4176-93b2-850147d4ebb3';
const remote = {
  environmentId,
  name: 'home-server',
  address: 'http://192.0.2.10:4738',
  credential: 'pcd_secret',
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

describe('parseRemotes', () => {
  it('keeps the saved remotes that are complete and drops the rest', () => {
    expect(
      parseRemotes([remote, { ...remote, credential: '' }, 'junk', null]),
    ).toEqual([remote]);
  });

  it('reads nothing from a value that is not a list', () => {
    expect(parseRemotes({ remotes: [remote] })).toEqual([]);
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
    ['a new address', { ...remote, address: 'http://192.0.2.11:4738' }],
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
