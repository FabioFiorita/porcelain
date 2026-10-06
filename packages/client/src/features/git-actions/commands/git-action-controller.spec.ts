import { Layer, ManagedRuntime } from 'effect';
import { afterEach } from 'vitest';
import type { Context } from 'effect';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { expect, it } from 'vitest';
import { Effect, Schema } from 'effect';
import {
  runGitActionRequestSchema,
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import {
  createWorktreeConnection,
  queryKeys,
  runRequest,
  type Transport,
} from '@porcelain/client/transport';
import {
  OperationStore,
  OperationStorage,
} from '@porcelain/client/git-actions';
import { GitActionController } from './git-action-controller.ts';

const scope = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: '0123456789abcdef0123456789abcdef',
};
const requestId = '22222222-2222-4222-8222-222222222222';
const nextRequestId = '33333333-3333-4333-8333-333333333333';
const input: Pick<RunGitActionRequest, 'input' | 'expected'> = {
  input: { action: 'commit', message: 'Save changes', paths: ['file.ts'] },
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
  action: 'commit',
  state: 'succeeded',
  acceptedAt: '2026-10-05T10:00:00.000Z',
  progress: [],
};

function setup(
  transport: Transport,
  operations: Context.Service.Shape<
    typeof OperationStore
  > = operationStoreFixture().store,
) {
  const lifetime = createWorktreeConnection({
    environmentId: 'controller',
    transport,
    timeoutMs: 1000,
  });
  const client = new QueryClient();
  let ids = 0;
  const controller = new GitActionController(
    scope,
    'commit',
    lifetime.connection,
    operations,
    client,
    lifetime.controller.signal,
    () => {
      ids += 1;
      return requestId;
    },
  );
  return {
    ...lifetime,
    signal: lifetime.controller.signal,
    controller,
    operations,
    client,
    ids: () => ids,
    run: () =>
      runRequest(controller.execute(input), lifetime.controller.signal),
    close: async () => {
      await lifetime.close();
      client.clear();
    },
  };
}

it('retains the original request after an unanswered write and resends that exact request on recovery', async () => {
  const sent: string[] = [];
  const subject = setup((_path, init) => {
    if (!(init?.body instanceof Uint8Array))
      throw new Error('Expected encoded write');
    sent.push(new TextDecoder().decode(init.body));
    return sent.length === 1
      ? Promise.reject(new Error('Disconnected after send'))
      : Promise.resolve(Response.json(receipt));
  });
  try {
    await expect(subject.run()).rejects.toThrow('Could not reach Porcelain');
    await expect(subject.run()).rejects.toThrow('Check the existing receipt');
    expect(sent).toHaveLength(1);
    await expect(
      runRequest(subject.controller.recover(), subject.signal),
    ).resolves.toEqual(receipt);
    expect(sent).toEqual([
      JSON.stringify(
        Schema.encodeSync(runGitActionRequestSchema)({ ...input, requestId }),
      ),
      sent[0],
    ]);
    expect(subject.ids()).toBe(1);
    expect(
      subject.operations.state.value.operations.get(subject.controller.key)
        ?.receipt,
    ).toEqual(receipt);
  } finally {
    await subject.close();
  }
});

it('refuses an action mismatch before retaining a request or contacting the server', async () => {
  let sent = 0;
  const subject = setup(() => {
    sent += 1;
    return Promise.resolve(Response.json(receipt));
  });
  try {
    await expect(
      runRequest(
        subject.controller.execute({
          ...input,
          input: {
            action: 'stash-create',
            message: 'Save changes',
            includeUntracked: true,
          },
        }),
        subject.signal,
      ),
    ).rejects.toThrow('Action mismatch');
    expect(sent).toBe(0);
    expect(subject.ids()).toBe(0);
    expect([...subject.operations.state.value.operations.values()]).toEqual([]);
  } finally {
    await subject.close();
  }
});

it('rejects a receipt for another worktree without accepting it into the retained operation', async () => {
  const subject = setup(() =>
    Promise.resolve(
      Response.json({
        ...receipt,
        worktreeId: 'abcdef0123456789abcdef0123456789',
      }),
    ),
  );
  try {
    await expect(subject.run()).rejects.toThrow('connected context changed');
    expect(
      subject.operations.state.value.operations.get(subject.controller.key)
        ?.receipt,
    ).toBeUndefined();
  } finally {
    await subject.close();
  }
});

it('rejects an old receipt when a newer operation replaces it during cache refresh', async () => {
  const subject = setup(() => Promise.resolve(Response.json(receipt)));
  const refreshStarted = Promise.withResolvers<void>();
  const refresh = Promise.withResolvers<string>();
  const key = queryKeys.worktreeSurface(subject.connection, scope, ['changes']);
  subject.client.setQueryData(key, 'before');
  const observer = new QueryObserver(subject.client, {
    queryKey: key,
    staleTime: Infinity,
    queryFn: () => {
      refreshStarted.resolve();
      return refresh.promise;
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const result = subject.run();
    const failure = expect(result).rejects.toThrow('connected context changed');
    await refreshStarted.promise;
    await Effect.runPromise(
      subject.operations.set(subject.controller.key, {
        ...scope,
        requestId: nextRequestId,
        request: { ...input, requestId: nextRequestId },
      }),
    );
    refresh.resolve('after');
    await failure;
    expect(
      subject.operations.state.value.operations.get(subject.controller.key),
    ).toMatchObject({
      requestId: nextRequestId,
    });
    expect(
      subject.operations.state.value.operations.get(subject.controller.key)
        ?.receipt,
    ).toBeUndefined();
  } finally {
    refresh.resolve('cleanup');
    unsubscribe();
    await subject.close();
  }
});

it('keeps an accepted running request recoverable when its caller cancels waiting', async () => {
  const received = Promise.withResolvers<void>();
  const subject = setup(() =>
    Promise.resolve(Response.json({ ...receipt, state: 'running' })),
  );
  const unsubscribe = subject.operations.state.subscribe(() => {
    if (
      subject.operations.state.value.operations.get(subject.controller.key)
        ?.receipt?.state === 'running'
    )
      received.resolve();
  });
  const caller = new AbortController();
  const cancelled = new Error('Dialog closed');
  try {
    const result = runRequest(subject.controller.execute(input), caller.signal);
    const failure = expect(result).rejects.toBe(cancelled);
    await received.promise;
    caller.abort(cancelled);
    await failure;
    expect(
      subject.operations.state.value.operations.get(subject.controller.key)
        ?.requestId,
    ).toBe(requestId);
    expect(await Effect.runPromise(subject.controller.startNew())).toBe(false);
    expect(await Effect.runPromise(subject.operations.accept(receipt))).toBe(
      true,
    );
    expect(await Effect.runPromise(subject.controller.startNew())).toBe(true);
    expect([...subject.operations.state.value.operations.values()]).toEqual([]);
  } finally {
    unsubscribe();
    await subject.close();
  }
});

it('does not send or publish a Git operation when its recovery identity cannot be persisted', async () => {
  let sent = 0;
  let notified = 0;
  const operations = operationStoreFixture({
    key: 'device-operations',
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage full');
      },
      removeItem: () => {},
    },
  }).store;
  const unsubscribe = operations.state.subscribe(() => {
    notified += 1;
  });
  const subject = setup(() => {
    sent += 1;
    return Promise.resolve(Response.json(receipt));
  }, operations);
  try {
    await expect(subject.run()).rejects.toThrow(
      'Could not save the Git operation',
    );
    expect(sent).toBe(0);
    expect(notified).toBe(0);
    expect([...operations.state.value.operations.values()]).toEqual([]);
  } finally {
    unsubscribe();
    await subject.close();
  }
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
