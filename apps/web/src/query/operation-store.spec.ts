import { expect, it } from 'vitest';
import type { Operation, Receipt } from '../domain/git-action';
import { createOperationStore, operationKey } from './operation-store';

const scope = {
  projectId: '00000000-0000-4000-8000-000000000002',
  worktreeId: 'a'.repeat(32),
};
const requestId = '00000000-0000-4000-8000-000000000003';
const key = operationKey(scope, 'fetch');
function pending(): Operation {
  return {
    ...scope,
    requestId,
    request: {
      requestId,
      input: {
        action: 'fetch',
        remoteName: 'origin',
        sourceRef: 'refs/heads/main',
      },
      expected: {
        inProgress: null,
        mergeHeadOid: null,
        headOid: null,
        branch: 'main',
        upstreamOid: null,
      },
    },
  };
}
function receipt(state: Receipt['state']): Receipt {
  return {
    ...scope,
    requestId,
    action: 'fetch',
    state,
    acceptedAt: 1,
    progress: ['Receiving objects'],
  };
}

it('keeps a live completion when the initial HTTP response arrives afterward', async () => {
  const store = createOperationStore();
  store.set(key, pending());
  const finished = receipt('succeeded');
  store.accept(finished);
  store.accept(receipt('running'));
  expect(await store.wait(key, new AbortController().signal)).toEqual(finished);
  expect(store.get(key)?.receipt?.state).toBe('succeeded');
});

it('does not let an unrelated receipt finish a waiting action', async () => {
  const store = createOperationStore();
  const controller = new AbortController();
  store.set(key, pending());
  const finished = store.wait(key, controller.signal);
  expect(store.accept({ ...receipt('succeeded'), worktreeId: 'other' })).toBe(
    false,
  );
  expect(store.accept({ ...receipt('succeeded'), requestId: 'other' })).toBe(
    false,
  );
  expect(store.get(key)?.receipt).toBeUndefined();
  store.accept(receipt('interrupted'));
  expect((await finished).state).toBe('interrupted');
});

it('ends connection waiters without losing the exact uncertain request', async () => {
  const store = createOperationStore();
  const controller = new AbortController();
  const operation = pending();
  store.set(key, operation);
  const finished = store.wait(key, controller.signal);
  const assertion = expect(finished).rejects.toThrow('Disconnected');
  controller.abort(new Error('Disconnected'));
  await assertion;
  expect(store.get(key)?.request).toEqual(operation.request);
});

it('restores exact uncertain requests after a page reload, and clears them after completion or logout', () => {
  const saved = new Map<string, string>();
  const persistence = {
    key: 'environment',
    storage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
      removeItem: (key: string) => {
        saved.delete(key);
      },
    },
  };
  const original = createOperationStore(persistence);
  original.set(key, pending());
  const restored = createOperationStore(persistence);
  expect(restored.get(key)?.request).toEqual(pending().request);
  restored.accept(receipt('succeeded'));
  expect(createOperationStore(persistence).list()).toEqual([]);
  restored.set(key, pending());
  restored.clear();
  expect(createOperationStore(persistence).list()).toEqual([]);
});
