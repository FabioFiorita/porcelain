import { Cause, Effect, Exit, Fiber } from 'effect';
import { expect, it } from 'vitest';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { createOperationStore, operationKey } from './operations.ts';

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
  const store = createOperationStore(persistence);
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  await Effect.runPromise(store.accept(receipt));
  const restored = createOperationStore(persistence);
  expect(restored.get(key)).toEqual({ ...scope, requestId, request });
  expect(
    await Effect.runPromise(
      restored.accept({ ...receipt, state: 'succeeded' }),
    ),
  ).toBe(true);
  expect(retained.has('operations')).toBe(false);
});

it('refuses foreign and regressing receipts without changing a confirmed operation', async () => {
  const store = createOperationStore();
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
  expect(store.get(key)?.receipt?.state).toBe('succeeded');
});

it('rejects the old waiter when its retained request is replaced', async () => {
  const store = createOperationStore();
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
  expect(store.get(key)?.requestId).toBe(nextId);
});

it('interrupts waiting without deleting the durable operation', async () => {
  const store = createOperationStore();
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  const fiber = Effect.runFork(store.wait(key, requestId));
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(store.get(key)?.request).toEqual(request);
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
    const store = createOperationStore({
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
    });
    await expect(
      Effect.runPromise(store.set(key, { ...scope, requestId, request })),
    ).rejects.toThrow('Could not restore pending Git operations');
    expect(writes).toBe(0);
    expect(store.list()).toEqual([]);
  },
);

it('keeps the running request recoverable when confirmation cannot remove its persisted record', async () => {
  const retained = new Map<string, string>();
  let full = true;
  const store = createOperationStore({
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
  });
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  await Effect.runPromise(store.accept(receipt));
  const original = retained.get('operations');
  await expect(
    Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' })),
  ).rejects.toThrow('Could not save the Git operation');
  expect(store.get(key)?.receipt?.state).toBe('running');
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
  const store = createOperationStore(persistence);
  await Effect.runPromise(store.set(key, { ...scope, requestId, request }));
  const waiting = Effect.runFork(store.wait(key, requestId));
  store.close();
  await expect(Effect.runPromise(Fiber.join(waiting))).rejects.toThrow(
    'connected context changed',
  );
  const late = await Effect.runPromiseExit(store.set(key, null));
  expect(Exit.isFailure(late) && Cause.hasInterrupts(late.cause)).toBe(true);
  const reopened = createOperationStore(persistence);
  expect(reopened.get(key)).toEqual({ ...scope, requestId, request });
});
