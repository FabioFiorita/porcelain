import {
  unreadablePersistence,
  promiseStorage,
  blockedPersistence,
} from '../../../spec/kit/promise-storage.ts';
import { operationStoreFixture } from '../../../spec/kit/operation-store.ts';
import { runGitActionRequestSchema } from '@porcelain/contracts/git-actions';
import { Redacted, Effect, Fiber, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { AccessStore } from './store.ts';
import {
  EnvironmentStorage,
  type EnvironmentSnapshot,
} from '@porcelain/client/access';
import {
  operationJournalKey,
  type Remote,
} from '@porcelain/client/access/rules';

const first: Remote = {
  environmentId: 'first',
  name: 'First computer',
  address: 'http://first.local:4738',
  credential: Redacted.make('first-credential'),
  deviceId: 'first-device',
};
const second: Remote = {
  environmentId: 'second',
  name: 'Second computer',
  address: 'http://second.local:4738',
  credential: Redacted.make('second-credential'),
  deviceId: 'second-device',
};

function fixture(storage: {
  read: () => Promise<readonly Remote[]>;
  write: (value: readonly Remote[]) => Promise<void>;
}) {
  return Effect.runSync(
    AccessStore.pipe(
      Effect.provide(AccessStore.layer),
      Effect.provideService(
        EnvironmentStorage,
        promiseStorage({
          ...storage,
          read: async () => ({
            remotes: [...(await storage.read())],
            missingCredentials: [],
          }),
          write: (snapshot) => storage.write(snapshot.remotes),
        }),
      ),
    ),
  );
}

describe('saved environments', () => {
  it('forgets only the selected environment and keeps the other one after restoring', async () => {
    let saved = [first, second];
    const storage = {
      read: () => Promise.resolve(saved),
      write: (remotes: readonly Remote[]) => {
        saved = [...remotes];
        return Promise.resolve();
      },
    };
    const store = fixture(storage);
    await Effect.runPromise(store.load());
    await Effect.runPromise(store.forget(first.environmentId));
    expect(store.state.value.remotes).toEqual([second]);
    const restored = fixture(storage);
    await Effect.runPromise(restored.load());
    expect(restored.state.value.remotes).toEqual([second]);
  });
  it('refuses a write before saved state has been read', async () => {
    const persisted: Remote[][] = [];
    const store = fixture({
      read: () => Promise.resolve([first]),
      write: (remotes) => {
        persisted.push([...remotes]);
        return Promise.resolve();
      },
    });
    await expect(Effect.runPromise(store.save(second))).rejects.toThrow('read');
    expect(persisted).toEqual([]);
    await Effect.runPromise(store.load());
    expect(store.state.value.remotes).toEqual([first]);
    expect(store.state.value.status).toBe('ready');
  });

  it('persists a replacement before publishing it and preserves other environments', async () => {
    let saved = [first, second];
    const observed: (readonly Remote[])[] = [];
    const store = fixture({
      read: () => Promise.resolve(saved),
      write: (remotes) => {
        observed.push(store.state.value.remotes);
        saved = [...remotes];
        return Promise.resolve();
      },
    });
    await Effect.runPromise(store.load());
    const replacement = {
      ...first,
      credential: Redacted.make('new'),
      deviceId: 'new-device',
    };
    await Effect.runPromise(store.save(replacement));
    expect(observed).toEqual([[first, second]]);
    expect(store.state.value.remotes).toEqual([
      second,
      { ...replacement, operationIdentity: operationJournalKey(first) },
    ]);
    const restored = fixture({
      read: () => Promise.resolve(saved),
      write: () => Promise.resolve(),
    });
    await Effect.runPromise(restored.load());
    expect(restored.state.value.remotes).toEqual([
      second,
      { ...replacement, operationIdentity: operationJournalKey(first) },
    ]);
  });

  it('does not overwrite unreadable saved state or expose storage internals', async () => {
    const { storage, writeCount } = unreadablePersistence<readonly Remote[]>();
    const store = fixture(storage);
    await Effect.runPromise(store.load());
    expect(store.state.value.status).toBe('unreadable');
    expect(store.state.value.error).toBe(
      'Saved environments could not be read. Try reading them again.',
    );
    await expect(Effect.runPromise(store.save(second))).rejects.toThrow('read');
    expect(writeCount()).toBe(0);
  });
});

it('serializes concurrent saved environments against the last persisted state', async () => {
  const { started, finish, writes, storage } = blockedPersistence<
    readonly Remote[]
  >([]);
  const store = fixture(storage);
  await Effect.runPromise(store.load());
  const savingFirst = Effect.runPromise(store.save(first));
  const savingSecond = Effect.runPromise(store.save(second));
  await started.promise;
  expect(writes).toEqual([[first]]);
  expect(store.state.value.remotes).toEqual([]);
  finish.resolve();
  await Promise.all([savingFirst, savingSecond]);
  expect(writes).toEqual([[first], [first, second]]);
  expect(store.state.value.remotes).toEqual([first, second]);
});
it('stops dependent persistence after a failed save and retains its cause', async () => {
  const writes: Remote[][] = [];
  const failure = new Error('storage unavailable');
  const store = fixture({
    read: () => Promise.resolve([first]),
    write: (remotes) => {
      writes.push([...remotes]);
      return Promise.reject(failure);
    },
  });
  await Effect.runPromise(store.load());
  const saving = Effect.runPromise(store.save(second));
  const forgetting = Effect.runPromise(store.forget(first.environmentId));
  const results = await Promise.allSettled([saving, forgetting]);
  expect(results[0]).toMatchObject({
    status: 'rejected',
    reason: {
      name: 'ConnectionError',
      message:
        'The saved environments could not be updated. Read them again before making changes.',
      cause: failure,
    },
  });
  expect(results[1]).toMatchObject({
    status: 'rejected',
    reason: {
      name: 'WriteNotSentError',
      cause: { name: 'ConnectionError', cause: failure },
    },
  });
  expect(writes).toEqual([[first, second]]);
  expect(store.state.value.remotes).toEqual([first]);
  expect(store.state.value.status).toBe('unreadable');
});

it('publishes an admitted save before cancellation finishes, so a later save includes it', async () => {
  const snapshots: (readonly Remote[])[] = [];
  const { started, finish, writes, storage } = blockedPersistence<
    readonly Remote[]
  >([]);
  const store = fixture(storage);
  const unsubscribe = store.state.subscribe((state) =>
    snapshots.push(state.remotes),
  );
  await Effect.runPromise(store.load());
  const saving = Effect.runFork(store.save(first));
  await started.promise;
  const cancelled = Effect.runPromise(Fiber.interrupt(saving));
  expect(store.state.value.remotes).toEqual([]);
  finish.resolve();
  await cancelled;
  expect(store.state.value.remotes).toEqual([first]);
  expect(snapshots.at(-1)).toEqual([first]);
  unsubscribe();
  const observed = snapshots.length;
  await Effect.runPromise(store.save(second));
  expect(writes).toEqual([[first], [first, second]]);
  expect(store.state.value.remotes).toEqual([first, second]);
  expect(snapshots).toHaveLength(observed);
});

it('persists route preference and removal without duplicating or forgetting the computer', async () => {
  let saved: readonly Remote[] = [first];
  const storage = {
    read: () => Promise.resolve(saved),
    write: (value: readonly Remote[]) => {
      saved = value;
      return Promise.resolve();
    },
  };
  const store = fixture(storage);
  await Effect.runPromise(store.load());
  const tailnet = {
    ...first,
    address: 'https://development.example.ts.net',
    credential: Redacted.make('tailnet-credential'),
    deviceId: 'tailnet-device',
  };
  await Effect.runPromise(store.save(tailnet));
  expect(saved).toHaveLength(1);
  expect(saved[0]?.address).toBe(first.address);
  await Effect.runPromise(
    store.route({
      environmentId: first.environmentId,
      address: tailnet.address,
      kind: 'prefer',
    }),
  );
  const restored = fixture(storage);
  await Effect.runPromise(restored.load());
  expect(restored.state.value.remotes[0]?.address).toBe(tailnet.address);
  expect(restored.state.value.remotes[0]?.alternateRoutes?.[0]?.address).toBe(
    first.address,
  );
  await Effect.runPromise(
    restored.route({
      environmentId: first.environmentId,
      address: tailnet.address,
      kind: 'remove',
    }),
  );
  expect(saved).toEqual([
    { ...first, operationIdentity: operationJournalKey(first) },
  ]);
  await expect(
    Effect.runPromise(
      restored.route({
        environmentId: first.environmentId,
        address: first.address,
        kind: 'remove',
      }),
    ),
  ).rejects.toThrow('last connection');
  expect(saved).toEqual([
    { ...first, operationIdentity: operationJournalKey(first) },
  ]);
});

it('restores a pending Git request from the same journal after a preference change', async () => {
  const alternative = {
    address: 'https://development.example.ts.net',
    credential: Redacted.make('alternate'),
    deviceId: 'alternate-device',
  };
  const identity = operationJournalKey(first);
  if (!identity) throw new Error('No initial journal');
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  };
  const original = operationStoreFixture({ key: identity, storage });
  const request = Schema.decodeUnknownSync(runGitActionRequestSchema)({
    requestId: '33333333-3333-4333-8333-333333333333',
    input: {
      action: 'fetch',
      remoteName: 'upstream',
      sourceRef: 'refs/heads/topic',
    },
    expected: {
      headOid: null,
      branch: null,
      inProgress: null,
      mergeHeadOid: null,
    },
  });
  await Effect.runPromise(
    original.store.set('pending-fetch', {
      projectId: 'project',
      worktreeId: 'a'.repeat(32),
      requestId: request.requestId,
      request,
    }),
  );
  const commands = fixture({
    read: () => Promise.resolve([{ ...first, alternateRoutes: [alternative] }]),
    write: () => Promise.resolve(),
  });
  await Effect.runPromise(commands.load());
  await Effect.runPromise(
    commands.route({
      environmentId: first.environmentId,
      address: alternative.address,
      kind: 'prefer',
    }),
  );
  const remote = commands.state.value.remotes[0];
  if (!remote) throw new Error('Environment disappeared');
  const key = operationJournalKey(remote);
  if (!key) throw new Error('Journal disappeared');
  const replacement = operationStoreFixture({ key, storage });
  expect(
    [...replacement.store.state.value.operations.values()].map(
      (operation) => operation.requestId,
    ),
  ).toEqual(['33333333-3333-4333-8333-333333333333']);
});

function recoveryFixture(initial: EnvironmentSnapshot) {
  let snapshot = initial;
  const store = Effect.runSync(
    AccessStore.pipe(
      Effect.provide(AccessStore.layer),
      Effect.provideService(EnvironmentStorage, {
        read: () => Effect.succeed(snapshot),
        write: (next) =>
          Effect.sync(() => {
            snapshot = next;
          }),
      }),
    ),
  );
  return { store, saved: () => snapshot };
}

it.each(['second-primary', 'first-alternate'])(
  'keeps recovery metadata through unrelated pairing and repairs only %s',
  async (scenario) => {
    const missing =
      scenario === 'second-primary'
        ? {
            environmentId: second.environmentId,
            name: second.name,
            operationIdentity: 'stable-second',
            routes: [{ address: second.address, deviceId: second.deviceId }],
          }
        : {
            environmentId: first.environmentId,
            name: first.name,
            operationIdentity: 'stable-first',
            routes: [
              {
                address: 'http://first-remote.local',
                deviceId: 'alternate-device',
              },
            ],
          };
    const { store, saved } = recoveryFixture({
      remotes: scenario === 'second-primary' ? [first] : [first, second],
      missingCredentials: [missing],
    });
    await Effect.runPromise(store.load());
    expect(store.state.value.status).toBe('ready');
    expect(store.state.value.missingCredentials).toEqual([missing]);
    const third = {
      ...second,
      environmentId: 'third',
      address: 'http://third.local',
    };
    await Effect.runPromise(store.save(third));
    expect(saved().missingCredentials).toEqual([missing]);
    expect(saved().remotes[0]).toEqual(first);
    const repaired = {
      ...second,
      environmentId: missing.environmentId,
      address: missing.routes[0]?.address ?? '',
      credential: Redacted.make('repaired'),
      deviceId: 'repaired-device',
    };
    await Effect.runPromise(store.save(repaired));
    expect(saved().missingCredentials).toEqual([]);
    const recovered = saved().remotes.find(
      (remote) => remote.environmentId === missing.environmentId,
    );
    expect(recovered?.operationIdentity).toBe(
      scenario === 'second-primary'
        ? 'stable-second'
        : operationJournalKey(first),
    );
    if (scenario === 'first-alternate') {
      expect(recovered?.credential).toEqual(first.credential);
      expect(recovered?.deviceId).toBe('first-device');
      expect(recovered?.alternateRoutes).toEqual([
        {
          address: 'http://first-remote.local',
          credential: repaired.credential,
          deviceId: 'repaired-device',
        },
      ]);
    }
    expect(saved().remotes).toContainEqual(third);
  },
);

it('forgets only the selected missing record and keeps healthy computers and other missing routes', async () => {
  const missing = [first, second].map((remote) => ({
    environmentId: remote.environmentId,
    name: remote.name,
    routes: [{ address: remote.address, deviceId: remote.deviceId }],
  }));
  const { store, saved } = recoveryFixture({
    remotes: [first],
    missingCredentials: missing,
  });
  await Effect.runPromise(store.load());
  await Effect.runPromise(store.forget(second.environmentId));
  expect(saved()).toEqual({
    remotes: [first],
    missingCredentials: [missing[0]],
  });
});
