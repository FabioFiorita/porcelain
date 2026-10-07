import { operationStoreLayer } from '@porcelain/client/git-actions';
import { Crypto, Equal, Exit, Layer, ManagedRuntime } from 'effect';
import { afterEach } from 'vitest';
import type { Context } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { readChanges } from '@porcelain/client/changes';
import { expect } from 'vitest';
import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import {
  runGitActionRequestSchema,
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import {
  OperationStore,
  OperationStorage,
  operationKey,
} from '@porcelain/client/git-actions';
import {
  runGitAction,
  gitActionCommands,
  recoverGitAction,
  startNewGitAction,
} from './git-action-controller.ts';

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
  const registry = AtomRegistry.make();
  let ids = 0;
  const lifetime = createWorktreeConnection(
    {
      environmentId: '44444444-4444-4444-8444-444444444444',
      transport,
      timeoutMs: 1000,
    },
    undefined,
    Layer.merge(
      Layer.succeed(OperationStore, operations),
      Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          randomBytes: () => {
            ids++;
            return new Uint8Array(
              requestId
                .replaceAll('-', '')
                .match(/../g)
                ?.map((part) => parseInt(part, 16)) ?? [],
            );
          },
          digest: (_, bytes) => Effect.succeed(bytes),
        }),
      ),
    ),
  );
  const connection = Equal.byReference({
    ...lifetime.connection,
    operations,
  });
  const selection = { connection, scope, action: 'commit' as const };
  const command = runGitAction(selection);
  const recover = recoverGitAction(selection);
  const startNew = startNewGitAction(selection);
  const execute = <Input, A, E>(
    atom: Atom.AtomResultFn<Input, A, E>,
    input: Input,
  ) => {
    registry.set(atom, input);
    return Effect.runPromise(
      AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
    );
  };
  return {
    connection,
    commands: gitActionCommands(selection, registry),
    key: operationKey(scope, 'commit'),
    command,
    operations,
    registry,
    ids: () => ids,
    run: (request: Pick<RunGitActionRequest, 'input' | 'expected'> = input) =>
      execute(command, request),
    recovery: recover,
    recover: () => execute(recover, undefined),
    startNew: () => execute(startNew, undefined),
    close: async () => {
      registry.dispose();
      await lifetime.close();
    },
  };
}

it.effect(
  'composes recovery and reset without losing the retained write identity',
  () =>
    Effect.gen(function* () {
      const sent: string[] = [];
      const subject = yield* Effect.acquireRelease(
        Effect.sync(() =>
          setup((_path, init) => {
            if (!(init?.body instanceof Uint8Array))
              throw new Error('Expected encoded write');
            sent.push(new TextDecoder().decode(init.body));
            return sent.length === 1
              ? Promise.reject(new Error('Disconnected after send'))
              : Promise.resolve(Response.json(receipt));
          }),
        ),
        (subject) => Effect.promise(subject.close),
      );
      const failed = yield* Effect.exit(
        subject.commands.run(input.input, input.expected),
      );
      expect(Exit.isFailure(failed)).toBe(true);
      expect(
        subject.operations.state.value.operations.get(subject.key)?.requestId,
      ).toBe(requestId);
      expect(yield* subject.commands.recover()).toEqual(receipt);
      expect(sent).toEqual([sent[0], sent[0]]);
      expect(subject.ids()).toBe(1);
      yield* subject.commands.startNew();
      expect(
        subject.operations.state.value.operations.get(subject.key),
      ).toBeUndefined();
      expect(subject.registry.get(subject.command)._tag).toBe('Initial');
      expect(subject.registry.get(subject.recovery)._tag).toBe('Initial');
    }),
);

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
    await expect(subject.recover()).resolves.toEqual(receipt);
    expect(sent).toEqual([
      JSON.stringify(
        Schema.encodeSync(runGitActionRequestSchema)({ ...input, requestId }),
      ),
      sent[0],
    ]);
    expect(subject.ids()).toBe(1);
    expect(
      subject.operations.state.value.operations.get(subject.key)?.receipt,
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
      subject.run({
        ...input,
        input: {
          action: 'stash-create',
          message: 'Save changes',
          includeUntracked: true,
        },
      }),
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
      subject.operations.state.value.operations.get(subject.key)?.receipt,
    ).toBeUndefined();
  } finally {
    await subject.close();
  }
});

it('rejects an old receipt when a newer operation replaces it during cache refresh', async () => {
  const refreshStarted = Promise.withResolvers<void>();
  const refresh = Promise.withResolvers<Response>();
  let reads = 0;
  const before = {
    environmentId: '44444444-4444-4444-8444-444444444444',
    worktreeId: scope.worktreeId,
    statusToken: 'a'.repeat(64),
    headOid: null,
    branch: null,
    inProgress: null,
    mergeHeadOid: null,
    changes: [],
  };
  const subject = setup((path) => {
    if (!path.endsWith('/changes'))
      return Promise.resolve(Response.json(receipt));
    if (++reads === 1) return Promise.resolve(Response.json(before));
    refreshStarted.resolve();
    return refresh.promise;
  });
  const query = readChanges({ connection: subject.connection, scope });
  const unsubscribe = subject.registry.mount(query);
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, query));
  try {
    const result = subject.run();
    const failure = expect(result).rejects.toThrow('connected context changed');
    await refreshStarted.promise;
    await Effect.runPromise(
      subject.operations.set(subject.key, {
        ...scope,
        requestId: nextRequestId,
        request: { ...input, requestId: nextRequestId },
      }),
    );
    refresh.resolve(Response.json({ ...before, statusToken: 'b'.repeat(64) }));
    await failure;
    expect(
      subject.operations.state.value.operations.get(subject.key),
    ).toMatchObject({
      requestId: nextRequestId,
    });
    expect(
      subject.operations.state.value.operations.get(subject.key)?.receipt,
    ).toBeUndefined();
  } finally {
    refresh.resolve(Response.json(before));
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
      subject.operations.state.value.operations.get(subject.key)?.receipt
        ?.state === 'running'
    )
      received.resolve();
  });

  try {
    subject.registry.set(subject.command, input);
    const result = Effect.runPromiseExit(
      AtomRegistry.getResult(subject.registry, subject.command, {
        suspendOnWaiting: true,
      }),
    );
    await received.promise;
    subject.registry.set(subject.command, Atom.Interrupt);
    expect(Exit.isFailure(await result)).toBe(true);
    expect(
      subject.operations.state.value.operations.get(subject.key)?.requestId,
    ).toBe(requestId);
    expect(await subject.startNew()).toBe(false);
    expect(await Effect.runPromise(subject.operations.accept(receipt))).toBe(
      true,
    );
    expect(await subject.startNew()).toBe(true);
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
    operationStoreLayer.pipe(
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
