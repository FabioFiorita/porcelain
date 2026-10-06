import { Redacted, Cause, Effect, Fiber } from 'effect';
import { describe, expect, it } from 'vitest';
import { AccessStore } from './store.ts';
import { EnvironmentStorage } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';

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
  read: () => Promise<Remote[]>;
  write: (value: readonly Remote[]) => Promise<void>;
}) {
  return Effect.runSync(
    AccessStore.pipe(
      Effect.provide(AccessStore.layer),
      Effect.provideService(EnvironmentStorage, {
        read: () =>
          Effect.tryPromise({
            try: () => storage.read(),
            catch: (cause) => new Cause.UnknownError(cause),
          }),
        write: (value) =>
          Effect.tryPromise({
            try: () => storage.write(value),
            catch: (cause) => new Cause.UnknownError(cause),
          }),
      }),
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
    expect(store.state.value.remotes).toEqual([second, replacement]);
    const restored = fixture({
      read: () => Promise.resolve(saved),
      write: () => Promise.resolve(),
    });
    await Effect.runPromise(restored.load());
    expect(restored.state.value.remotes).toEqual([second, replacement]);
  });

  it('keeps the last read state and blocks further writes after persistence fails', async () => {
    let writes = 0;
    const store = fixture({
      read: () => Promise.resolve([first]),
      write: () => {
        writes += 1;
        return Promise.reject(new Error('secure storage failed'));
      },
    });
    await Effect.runPromise(store.load());
    await expect(Effect.runPromise(store.save(second))).rejects.toThrow(
      'updated',
    );
    expect(store.state.value.remotes).toEqual([first]);
    expect(store.state.value.status).toBe('unreadable');
    await expect(
      Effect.runPromise(store.forget(first.environmentId)),
    ).rejects.toThrow('read');
    expect(writes).toBe(1);
    await Effect.runPromise(store.load());
    expect(store.state.value.status).toBe('ready');
  });

  it('does not overwrite unreadable saved state or expose storage internals', async () => {
    let writes = 0;
    const store = fixture({
      read: () => Promise.reject(new Error('private storage detail')),
      write: () => {
        writes += 1;
        return Promise.resolve();
      },
    });
    await Effect.runPromise(store.load());
    expect(store.state.value.status).toBe('unreadable');
    expect(store.state.value.error).toBe(
      'Saved environments could not be read. Try reading them again.',
    );
    await expect(Effect.runPromise(store.save(second))).rejects.toThrow('read');
    expect(writes).toBe(0);
  });
});

it('serializes concurrent saved environments against the last persisted state', async () => {
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const writes: Remote[][] = [];
  const store = fixture({
    read: () => Promise.resolve([]),
    write: async (remotes) => {
      writes.push([...remotes]);
      if (writes.length === 1) {
        started.resolve();
        await finish.promise;
      }
    },
  });
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
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const snapshots: (readonly Remote[])[] = [];
  const writes: Remote[][] = [];
  const store = fixture({
    read: () => Promise.resolve([]),
    write: async (remotes) => {
      writes.push([...remotes]);
      if (writes.length === 1) {
        started.resolve();
        await finish.promise;
      }
    },
  });
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
