import { beforeEach, describe, expect, it } from 'vitest';
import { Effect, Redacted } from 'effect';
import {
  createEnvironmentStorage,
  type CredentialStorageHost,
} from './credential-storage';

const native = {
  metadata: new Map<string, string>(),
  keys: new Map<string, string>(),
  revisions: new Map<string, number>(),
  removed: new Set<string>(),
  failedReads: 0,
};
const host: CredentialStorageHost = {
  readMetadata: () =>
    Promise.resolve(native.metadata.get('environments') ?? null),
  writeMetadata: (value) => {
    native.metadata.set('environments', value);
    return Promise.resolve();
  },
  readCredential: (deviceId) => {
    if (native.failedReads > 0) {
      native.failedReads--;
      return Promise.reject(new Error('locked'));
    }
    return Promise.resolve(native.keys.get(key(deviceId)) ?? null);
  },
  writeCredential: (deviceId, value) => {
    const name = key(deviceId);
    native.revisions.set(name, (native.revisions.get(name) ?? 0) + 1);
    native.keys.set(name, value);
    return Promise.resolve();
  },
  forgetCredential: (deviceId) => {
    const name = key(deviceId);
    native.removed.add(name);
    native.keys.delete(name);
    return Promise.resolve();
  },
  developmentFixtures: () => false,
};
const { storage: environmentStorage } = createEnvironmentStorage(host);

const a = {
  environmentId: 'a',
  name: 'Computer A',
  address: 'http://a.local',
  deviceId: 'a-key',
  alternateRoutes: [
    { address: 'http://a-remote.local', deviceId: 'a-alternate' },
  ],
};
const b = {
  environmentId: 'b',
  name: 'Computer B',
  address: 'http://b.local',
  deviceId: 'b-key',
};
const key = (id: string) => `porcelain.device.${id}`;
beforeEach(() => {
  native.metadata.clear();
  native.keys.clear();
  native.revisions.clear();
  native.removed.clear();
  native.failedReads = 0;
  native.metadata.set('environments', JSON.stringify([a, b]));
  for (const id of ['a-key', 'a-alternate', 'b-key'])
    native.keys.set(key(id), `${id}-credential`);
});
describe('mobile saved credentials', () => {
  it.each([
    ['b-key', ['a'], 'b', 'http://b.local'],
    ['a-alternate', ['a', 'b'], 'a', 'http://a-remote.local'],
    ['a-key', ['a', 'b'], 'a', 'http://a.local'],
  ] as const)(
    'loads healthy routes when %s is absent and retains missing metadata on save',
    async (id, available, missing, address) => {
      native.keys.delete(key(id));
      const snapshot = await Effect.runPromise(environmentStorage.read());
      expect(snapshot.remotes.map((remote) => remote.environmentId)).toEqual(
        available,
      );
      expect(snapshot.missingCredentials).toMatchObject([
        { environmentId: missing, routes: [{ address, deviceId: id }] },
      ]);
      await Effect.runPromise(environmentStorage.write(snapshot));
      expect(native.revisions).toEqual(new Map());
      expect(native.removed).toEqual(new Set());
      expect(await Effect.runPromise(environmentStorage.read())).toEqual(
        snapshot,
      );
      expect(
        JSON.parse(native.metadata.get('environments') ?? ''),
      ).toHaveLength(2);
    },
  );
  it('keeps every record when all credentials are absent, and supports a first run', async () => {
    native.keys.clear();
    const snapshot = await Effect.runPromise(environmentStorage.read());
    expect(snapshot.remotes).toEqual([]);
    expect(
      snapshot.missingCredentials.map((remote) => remote.environmentId),
    ).toEqual(['a', 'b']);
    await Effect.runPromise(environmentStorage.write(snapshot));
    expect(JSON.parse(native.metadata.get('environments') ?? '')).toHaveLength(
      2,
    );
    native.metadata.clear();
    expect(await Effect.runPromise(environmentStorage.read())).toEqual({
      remotes: [],
      missingCredentials: [],
    });
  });
  it('fails on a transient keychain error without modifying metadata or credentials, then retries', async () => {
    const before = native.metadata.get('environments');
    native.failedReads = 1;
    await expect(
      Effect.runPromise(environmentStorage.read()),
    ).rejects.toThrow();
    expect(native.metadata.get('environments')).toBe(before);
    expect(native.revisions).toEqual(new Map());
    expect(native.removed).toEqual(new Set());
    expect(
      (await Effect.runPromise(environmentStorage.read())).remotes.map(
        (remote) => remote.environmentId,
      ),
    ).toEqual(['a', 'b']);
  });
  it('repairs only the missing key and preserves the valid computer and operation identity', async () => {
    native.keys.delete(key('b-key'));
    const snapshot = await Effect.runPromise(environmentStorage.read());
    const repaired = {
      ...b,
      deviceId: 'b-new',
      credential: Redacted.make('b-new-credential'),
      operationIdentity: snapshot.missingCredentials[0]?.operationIdentity,
    };
    await Effect.runPromise(
      environmentStorage.write({
        remotes: [...snapshot.remotes, repaired],
        missingCredentials: [],
      }),
    );
    expect(native.revisions).toEqual(new Map([[key('b-new'), 1]]));
    const restored = await Effect.runPromise(environmentStorage.read());
    expect(restored.remotes[0]).toEqual(snapshot.remotes[0]);
    expect(restored.remotes[1]?.operationIdentity).toBe(
      JSON.stringify(['b', 'http://b.local', 'b-key']),
    );
    expect(native.keys.get(key('a-key'))).toBe('a-key-credential');
  });
  it('forgets the broken computer without touching other credentials', async () => {
    native.keys.delete(key('b-key'));
    const snapshot = await Effect.runPromise(environmentStorage.read());
    await Effect.runPromise(
      environmentStorage.write({ ...snapshot, missingCredentials: [] }),
    );
    expect(native.removed).toEqual(new Set([key('b-key')]));
    expect(native.revisions).toEqual(new Map());
    expect(
      (await Effect.runPromise(environmentStorage.read())).remotes.map(
        (remote) => remote.environmentId,
      ),
    ).toEqual(['a']);
  });
});

it('treats an empty credential as missing without replacing it during unrelated saves', async () => {
  native.keys.set(key('b-key'), '');
  const snapshot = await Effect.runPromise(environmentStorage.read());
  expect(
    snapshot.missingCredentials.map((remote) => remote.environmentId),
  ).toEqual(['b']);
  await Effect.runPromise(environmentStorage.write(snapshot));
  expect(native.revisions).toEqual(new Map());
  expect(native.keys.get(key('b-key'))).toBe('');
});

it.each(['{', '[{"environmentId":"b"}]'])(
  'keeps malformed metadata unchanged (%s)',
  async (value) => {
    native.metadata.set('environments', value);
    await expect(
      Effect.runPromise(environmentStorage.read()),
    ).rejects.toThrow();
    expect(native.metadata.get('environments')).toBe(value);
    expect(native.revisions).toEqual(new Map());
    expect(native.removed).toEqual(new Set());
  },
);

it('refuses to replace an existing credential with different bytes', async () => {
  const snapshot = await Effect.runPromise(environmentStorage.read());
  const before = native.metadata.get('environments');
  await expect(
    Effect.runPromise(
      environmentStorage.write({
        ...snapshot,
        remotes: snapshot.remotes.map((remote) =>
          remote.environmentId === 'b'
            ? { ...remote, credential: Redacted.make('replacement') }
            : remote,
        ),
      }),
    ),
  ).rejects.toThrow('cannot be replaced');
  expect(native.keys.get(key('b-key'))).toBe('b-key-credential');
  expect(native.metadata.get('environments')).toBe(before);
  expect(native.revisions).toEqual(new Map());
  expect(native.removed).toEqual(new Set());
});

it.each([
  [false, 'http://10.0.2.2:4738'],
  [true, 'http://real-computer.local'],
] as const)(
  'refuses credential removal outside an emulator development fixture (%s, %s)',
  async (enabled, address) => {
    native.metadata.set('environments', JSON.stringify([{ ...a, address }]));
    const fixture = createEnvironmentStorage({
      ...host,
      developmentFixtures: () => enabled,
    });
    await expect(
      Effect.runPromise(fixture.removeDevelopmentCredential('a-key')),
    ).rejects.toThrow();
    expect(native.keys.get(key('a-key'))).toBe('a-key-credential');
    expect(native.removed).toEqual(new Set());
  },
);

it('removes only the selected emulator fixture key while retaining saved metadata', async () => {
  native.metadata.set(
    'environments',
    JSON.stringify([{ ...a, address: 'http://10.0.2.2:4738' }, b]),
  );
  const before = native.metadata.get('environments');
  const fixture = createEnvironmentStorage({
    ...host,
    developmentFixtures: () => true,
  });
  await Effect.runPromise(fixture.removeDevelopmentCredential('a-key'));
  expect(native.keys.has(key('a-key'))).toBe(false);
  expect(native.keys.get(key('b-key'))).toBe('b-key-credential');
  expect(native.keys.get(key('a-alternate'))).toBe('a-alternate-credential');
  expect(native.metadata.get('environments')).toBe(before);
  expect(native.removed).toEqual(new Set([key('a-key')]));
});
