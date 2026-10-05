import type { Context } from 'effect';
import { OperationStorage } from '../ports/operation-storage.ts';
import { Layer, ManagedRuntime } from 'effect';
import { afterEach } from 'vitest';
import { Cause, Deferred, Effect, Exit, Fiber, Schema } from 'effect';
import { expect, it } from 'vitest';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { OperationStore, operationKey } from './operations.ts';

const scope = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: '0123456789abcdef0123456789abcdef',
};
const requestId = '22222222-2222-4222-8222-222222222222';
const nextId = '33333333-3333-4333-8333-333333333333';
const request: RunGitActionRequest = {
  requestId,
  input: {
    action: 'fetch',
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  },
  expected: {
    headOid: undefined,
    branch: undefined,
    inProgress: undefined,
    mergeHeadOid: undefined,
  },
};
const receipt: RunGitActionResponse = {
  ...scope,
  requestId,
  action: 'fetch',
  state: 'running',
  progress: [],
  acceptedAt: '2026-10-05T10:00:00.000Z',
};
const key = operationKey(scope, 'fetch');
const persistedIdentities = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({
        requestId: Schema.String,
        projectId: Schema.String,
        worktreeId: Schema.String,
      }),
    ),
  ),
);

it('restores the unanswered request with its original identity and removes persistence after confirmation', async () => {
  const retained = new Map<string, string>();
  const persistence = {
    key: 'operations',
    storage: {
      getItem: (name: string) => retained.get(name) ?? null,
      setItem: (name: string, value: string) => {
        retained.set(name, value);
      },
      removeItem: (name: string) => {
        retained.delete(name);
      },
    },
  };
  const { store } = operationStoreFixture(persistence);
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  await Effect.runPromise(store.accept(receipt));
  const { store: restored } = operationStoreFixture(persistence);
  expect(restored.state.value.operations.get(key)).toEqual({
    ...scope,
    requestId,
    request,
  });
  expect(
    await Effect.runPromise(
      restored.accept({ ...receipt, state: 'succeeded' }),
    ),
  ).toBe(true);
  expect(retained.has('operations')).toBe(false);
});

it('refuses foreign and regressing receipts without changing a confirmed operation', async () => {
  const { store } = operationStoreFixture();
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  expect(
    await Effect.runPromise(store.accept({ ...receipt, requestId: nextId })),
  ).toBe(false);
  expect(
    await Effect.runPromise(store.accept({ ...receipt, projectId: nextId })),
  ).toBe(false);
  expect(
    await Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' })),
  ).toBe(true);
  expect(await Effect.runPromise(store.accept(receipt))).toBe(false);
  expect(store.state.value.operations.get(key)?.receipt?.state).toBe(
    'succeeded',
  );
});

it('rejects the old waiter when its retained request is replaced', async () => {
  const { store } = operationStoreFixture();
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  const fiber = Effect.runFork(store.wait(key, requestId));
  await Effect.runPromise(
    store.set(key, {
      ...scope,
      requestId: nextId,
      request: { ...request, requestId: nextId },
    }),
  );
  await expect(Effect.runPromise(Fiber.join(fiber))).rejects.toThrow(
    'connected context changed',
  );
  expect(store.state.value.operations.get(key)?.requestId).toBe(nextId);
});

it('interrupts waiting without deleting the durable operation', async () => {
  const { store } = operationStoreFixture();
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  const fiber = Effect.runFork(store.wait(key, requestId));
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(store.state.value.operations.get(key)?.request).toEqual(request);
  expect(
    await Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' })),
  ).toBe(true);
  await expect(
    Effect.runPromise(store.wait(key, requestId)),
  ).resolves.toMatchObject({ requestId, state: 'succeeded' });
});

it.each(['unreadable-json', '{}', '[{"requestId":"lost"}]'])(
  'refuses new writes without overwriting invalid recovery data: %s',
  async (saved) => {
    let writes = 0;
    const store = operationStoreFixture({
      key: 'operations',
      storage: {
        getItem: () => saved,
        setItem: () => {
          writes += 1;
        },
        removeItem: () => {
          writes += 1;
        },
      },
    }).store;
    await expect(
      Effect.runPromise(store.set(key, { ...scope, requestId, request })),
    ).rejects.toThrow('Could not restore pending Git operations');
    expect(writes).toBe(0);
    expect([...store.state.value.operations.values()]).toEqual([]);
  },
);

it('keeps the running request recoverable when confirmation cannot remove its persisted record', async () => {
  const retained = new Map<string, string>();
  let full = true;
  const store = operationStoreFixture({
    key: 'operations',
    storage: {
      getItem: (name) => retained.get(name) ?? null,
      setItem: (name, value) => {
        retained.set(name, value);
      },
      removeItem: (name) => {
        if (full) throw new Error('Storage unavailable');
        retained.delete(name);
      },
    },
  }).store;
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  await Effect.runPromise(store.accept(receipt));
  const original = retained.get('operations');
  await expect(
    Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' })),
  ).rejects.toThrow('Could not save the Git operation');
  expect(store.state.value.operations.get(key)?.receipt?.state).toBe('running');
  expect(retained.get('operations')).toBe(original);
  full = false;
  expect(
    await Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' })),
  ).toBe(true);
  expect(retained.has('operations')).toBe(false);
});

it('keeps unanswered requests on disk when a connection closes and refuses a late mutation', async () => {
  const retained = new Map<string, string>();
  const persistence = {
    key: 'operations',
    storage: {
      getItem: (name: string) => retained.get(name) ?? null,
      setItem: (name: string, value: string) => {
        retained.set(name, value);
      },
      removeItem: (name: string) => {
        retained.delete(name);
      },
    },
  };
  const { store, runtime } = operationStoreFixture(persistence);
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  const waiting = Effect.runFork(store.wait(key, requestId));
  await runtime.dispose();
  await expect(Effect.runPromise(Fiber.join(waiting))).rejects.toThrow(
    'connected context changed',
  );
  const late = await Effect.runPromiseExit(store.set(key, null));
  expect(Exit.isFailure(late) && Cause.hasInterrupts(late.cause)).toBe(true);
  const { store: reopened } = operationStoreFixture(persistence);
  expect(reopened.state.value.operations.get(key)).toEqual({
    ...scope,
    requestId,
    request,
  });
});

it('serializes storage admission so concurrent requests retain both identities', async () => {
  const entered = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  const writes: string[] = [];
  const { store } = operationStoreFixture(undefined, {
    read: () => Effect.succeed(null),
    write: (text) =>
      Effect.gen(function* () {
        writes.push(text);
        if (writes.length === 1) {
          yield* Deferred.succeed(entered, undefined);
          yield* Deferred.await(release);
        }
      }),
    clear: () => Effect.void,
  });
  const first = Effect.runFork(
    store.set(key, { ...scope, requestId, request }),
  );
  await Effect.runPromise(Deferred.await(entered));
  const secondScope = { ...scope, projectId: nextId };
  const second = Effect.runFork(
    store.set(operationKey(secondScope, 'fetch'), {
      ...secondScope,
      requestId: nextId,
      request: { ...request, requestId: nextId },
    }),
  );
  expect(writes).toHaveLength(1);
  expect(store.state.value.operations.size).toBe(0);
  await Effect.runPromise(Deferred.succeed(release, undefined));
  await Effect.runPromise(Fiber.join(first));
  await Effect.runPromise(Fiber.join(second));
  expect(
    writes.map((text) =>
      persistedIdentities(text).map((operation) => operation.requestId),
    ),
  ).toEqual([[requestId], [requestId, nextId]]);
  expect(
    [...store.state.value.operations.values()].map(
      (operation) => operation.requestId,
    ),
  ).toEqual([requestId, nextId]);
});

it('drains an admitted storage write and publishes its recoverable identity before caller interruption returns', async () => {
  const entered = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  let retained: string | undefined;
  const { store } = operationStoreFixture(undefined, {
    read: () => Effect.succeed(null),
    write: (text) =>
      Effect.gen(function* () {
        yield* Deferred.succeed(entered, undefined);
        yield* Deferred.await(release);
        retained = text;
      }),
    clear: () => Effect.void,
  });
  const controller = new AbortController();
  let settled = false;
  const writing = Effect.runPromiseExit(
    store.set(key, { ...scope, requestId, request }),
    { signal: controller.signal },
  ).then((exit) => {
    settled = true;
    return exit;
  });
  await Effect.runPromise(Deferred.await(entered));
  controller.abort();
  expect(settled).toBe(false);
  expect(store.state.value.operations.size).toBe(0);
  await Effect.runPromise(Deferred.succeed(release, undefined));
  expect(Exit.hasInterrupts(await writing)).toBe(true);
  expect(persistedIdentities(retained ?? '[]')).toMatchObject([
    { requestId, projectId: scope.projectId, worktreeId: scope.worktreeId },
  ]);
  expect(store.state.value.operations.get(key)?.requestId).toBe(requestId);
});

it('drains a pending storage write before disposing the connection and retains its recovery record', async () => {
  const entered = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  let retained: string | undefined;
  const { store, runtime } = operationStoreFixture(undefined, {
    read: () => Effect.succeed(null),
    write: (text) =>
      Effect.gen(function* () {
        yield* Deferred.succeed(entered, undefined);
        yield* Deferred.await(release);
        retained = text;
      }),
    clear: () => Effect.void,
  });
  const writing = Effect.runPromise(
    store.set(key, { ...scope, requestId, request }),
  );
  await Effect.runPromise(Deferred.await(entered));
  let disposed = false;
  const closing = runtime.dispose().then(() => {
    disposed = true;
  });
  expect(disposed).toBe(false);
  expect(store.state.value.closed).toBe(false);
  await Effect.runPromise(Deferred.succeed(release, undefined));
  await writing;
  await closing;
  expect(persistedIdentities(retained ?? '[]')).toEqual([
    { requestId, projectId: scope.projectId, worktreeId: scope.worktreeId },
  ]);
  expect(store.state.value).toMatchObject({
    closed: true,
    operations: new Map(),
  });
  expect(
    Exit.hasInterrupts(await Effect.runPromiseExit(store.set(key, null))),
  ).toBe(true);
});

const owned = new Set<ManagedRuntime.ManagedRuntime<OperationStore, never>>();
afterEach(async () => {
  const runtimes = [...owned];
  owned.clear();
  await Promise.all(runtimes.map((runtime) => runtime.dispose()));
});

function operationStoreFixture(
  persistence?: {
    key: string;
    storage: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  },
  storage?: Context.Service.Shape<typeof OperationStorage>,
) {
  const runtime = ManagedRuntime.make(
    OperationStore.layer.pipe(
      Layer.provide(
        Layer.succeed(
          OperationStorage,
          storage ?? {
            read: () =>
              Effect.try(
                () => persistence?.storage.getItem(persistence.key) ?? null,
              ),
            write: (value) =>
              Effect.try(() =>
                persistence?.storage.setItem(persistence.key, value),
              ),
            clear: () =>
              Effect.try(() =>
                persistence?.storage.removeItem(persistence.key),
              ),
          },
        ),
      ),
    ),
  );
  owned.add(runtime);
  return { runtime, store: runtime.runSync(OperationStore) };
}
