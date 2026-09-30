import { describe, expect, it } from 'vitest';
import {
  parseRemotes,
  remoteLink,
  remoteStatus,
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
  });
});

describe('withRemote', () => {
  it('replaces a remote paired again instead of listing it twice', () => {
    const renewed = { ...remote, credential: 'pcd_new' };
    expect(withRemote([remote], renewed)).toEqual([renewed]);
  });
});
