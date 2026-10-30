import { Redacted } from 'effect';
import { describe, expect, it } from 'vitest';
import { savedRemotes } from './remotes.ts';

const environmentId = '1bc3e6b1-f849-4176-93b2-850147d4ebb3';
const remote = {
  environmentId,
  name: 'home-server',
  address: 'http://192.0.2.10:4738',
  credential: 'pcd_secret',
};

describe('savedRemotes', () => {
  it('reads the remotes saved on this computer', () => {
    expect(
      savedRemotes({ status: 'saved', value: JSON.stringify([remote]) }),
    ).toEqual({
      kind: 'readable',
      remotes: [{ ...remote, credential: Redacted.make(remote.credential) }],
    });
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
