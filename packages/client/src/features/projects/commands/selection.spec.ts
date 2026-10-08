import {
  Redacted,
  Cause,
  Effect,
  Exit,
  Fiber,
  Layer,
  ManagedRuntime,
} from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { afterEach, expect, it } from 'vitest';
import {
  AccessPlatform,
  AccessStore,
  EnvironmentCommands,
  EnvironmentMutations,
  EnvironmentStorage,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { FileDrafts } from '@porcelain/client/files';
import { ConnectionError } from '@porcelain/client/transport';
import { ProjectSelectionCommands } from './selection.ts';
import {
  ProjectSelectionStorage,
  ProjectSelectionStore,
  WorkspaceSelectionCleanup,
  type ProjectSelectionSnapshot,
} from '@porcelain/client/projects';

const remote = (environmentId: string): Remote => ({
  environmentId,
  name: environmentId,
  address: `http://${environmentId}.local:4738`,
  credential: Redacted.make(`${environmentId}-credential`),
  deviceId: `${environmentId}-device`,
});
const runtimes: { dispose: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

function fixture(
  input: {
    readonly remotes?: Remote[];
    readonly selection?: ProjectSelectionSnapshot;
    readonly readEnvironments?: () => Promise<Remote[]>;
    readonly writeEnvironments?: (value: readonly Remote[]) => Promise<void>;
    readonly writeSelection?: (
      value: ProjectSelectionSnapshot,
    ) => Promise<void>;
  } = {},
) {
  let savedEnvironments = input.remotes ?? [remote('first'), remote('second')];
  let savedSelection: ProjectSelectionSnapshot = input.selection ?? {
    currentEnvironmentId: 'first',
    selections: {
      first: { projectId: 'one', worktreeId: 'one-tree' },
      second: { projectId: 'two', worktreeId: 'two-tree' },
    },
  };
  const writes: string[] = [];
  const ports = Layer.merge(
    Layer.succeed(EnvironmentStorage, {
      read: () =>
        Effect.tryPromise({
          try: () =>
            input.readEnvironments
              ? input.readEnvironments()
              : Promise.resolve(savedEnvironments),
          catch: (cause) => new Cause.UnknownError(cause),
        }),
      write: (value) =>
        Effect.tryPromise({
          try: async () => {
            writes.push('environments');
            await input.writeEnvironments?.(value);
            savedEnvironments = [...value];
          },
          catch: (cause) => new Cause.UnknownError(cause),
        }),
    }),
    Layer.succeed(ProjectSelectionStorage, {
      read: () =>
        Effect.sync(() => {
          writes.push('read-selection');
          return savedSelection;
        }),
      write: (value) =>
        Effect.tryPromise({
          try: async () => {
            writes.push('selection');
            await input.writeSelection?.(value);
            savedSelection = value;
          },
          catch: (cause) => new Cause.UnknownError(cause),
        }),
    }),
  );
  const stores = Layer.mergeAll(
    AccessStore.layer,
    ProjectSelectionStore.layer,
    EnvironmentMutations.layer,
    FileDrafts.layer,
  ).pipe(Layer.provide(ports));
  const cleanup = Layer.effect(
    WorkspaceSelectionCleanup,
    Effect.gen(function* () {
      const selection = yield* ProjectSelectionStore;
      return { forgetEnvironment: selection.forgetEnvironment };
    }),
  ).pipe(Layer.provide(stores));
  const platform = Layer.succeed(AccessPlatform, {
    name: () => 'Test device',
    send: () => Promise.reject(new Error('Selection must not use HTTP.')),
  });
  const application = Layer.merge(
    EnvironmentCommands.layer,
    ProjectSelectionCommands.layer,
  ).pipe(Layer.provideMerge(Layer.mergeAll(stores, cleanup, platform)));
  const runtime = ManagedRuntime.make(application);
  runtimes.push(runtime);
  const access = runtime.runSync(AccessStore);
  const selection = runtime.runSync(ProjectSelectionStore);
  const environments = runtime.runSync(EnvironmentCommands);
  const commands = runtime.runSync(ProjectSelectionCommands);
  const drafts = runtime.runSync(FileDrafts);
  return {
    runtime,
    application,
    access,
    selection,
    environments,
    commands,
    drafts,
    writes,
    saved: () => ({
      environments: savedEnvironments,
      selection: savedSelection,
    }),
  };
}

it('waits for saved environments before restoring and pruning remembered workspaces', async () => {
  const reading = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<Remote[]>();
  const f = fixture({
    readEnvironments: () => {
      reading.resolve();
      return finish.promise;
    },
    selection: {
      currentEnvironmentId: 'forgotten',
      selections: {
        forgotten: { projectId: 'old', worktreeId: 'old-tree' },
        second: { projectId: 'two', worktreeId: 'two-tree' },
      },
    },
  });
  const loading = f.runtime.runPromise(f.environments.read());
  await reading.promise;
  const selecting = f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  expect(f.commands.pending.value).toBe(1);
  expect(f.writes).toEqual([]);
  finish.resolve([remote('second')]);
  await Promise.all([loading, selecting]);
  expect(f.saved().selection).toEqual({
    currentEnvironmentId: undefined,
    selections: { second: { projectId: 'two', worktreeId: 'two-tree' } },
  });
  expect(f.commands.pending.value).toBe(0);
});

it('keeps remembered workspaces when saved environments are unreadable', async () => {
  const f = fixture({
    readEnvironments: () => Promise.reject(new Error('Keychain locked.')),
  });
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  expect(f.access.state.value.status).toBe('unreadable');
  expect(f.selection.state.value.currentEnvironmentId).toBe('first');
  expect(f.saved().selection.selections).toEqual({
    first: { projectId: 'one', worktreeId: 'one-tree' },
    second: { projectId: 'two', worktreeId: 'two-tree' },
  });
  expect(f.writes).toEqual(['read-selection']);
});

it('shares the application queue with native atoms and refuses a selection queued behind forgetting', async () => {
  const writing = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const f = fixture({
    writeEnvironments: async () => {
      writing.resolve();
      await finish.promise;
    },
  });
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  f.writes.length = 0;
  const registry = AtomRegistry.make();
  const atomRuntime = Atom.context({ memoMap: f.runtime.memoMap })(
    f.application,
  );
  const choose = atomRuntime.fn((environmentId: string) =>
    Effect.gen(function* () {
      const commands = yield* ProjectSelectionCommands;
      yield* commands.execute({ kind: 'environment', environmentId });
    }),
  );
  try {
    const forgetting = f.runtime.runPromise(f.environments.forget('first'));
    await writing.promise;
    registry.set(choose, 'first');
    const choosing = Effect.runPromiseExit(
      AtomRegistry.getResult(registry, choose, { suspendOnWaiting: true }),
    );
    expect(f.commands.pending.value).toBe(2);
    expect(f.writes).toEqual(['environments']);
    finish.resolve();
    await forgetting;
    const exit = await choosing;
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
      message:
        'That environment is no longer paired. Open the workspace picker again.',
    });
    expect(f.saved()).toEqual({
      environments: [remote('second')],
      selection: {
        currentEnvironmentId: undefined,
        selections: { second: { projectId: 'two', worktreeId: 'two-tree' } },
      },
    });
    expect(f.writes).toEqual(['environments', 'selection']);
    expect(f.commands.pending.value).toBe(0);
  } finally {
    registry.dispose();
  }
});

it('releases a cancelled queued choice without saving it or hiding the active selection', async () => {
  const writing = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const f = fixture({
    writeSelection: async () => {
      writing.resolve();
      await finish.promise;
    },
  });
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  f.writes.length = 0;
  const first = f.runtime.runPromise(
    f.commands.execute({ kind: 'environment', environmentId: 'second' }),
  );
  await writing.promise;
  const queued = f.runtime.runFork(
    f.commands.execute({ kind: 'environment', environmentId: 'first' }),
  );
  try {
    expect(f.commands.pending.value).toBe(2);
    await Effect.runPromise(Fiber.interrupt(queued));
    const exit = await Effect.runPromise(Fiber.await(queued));
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(f.commands.pending.value).toBe(1);
    finish.resolve();
    await first;
    expect(f.saved().selection.currentEnvironmentId).toBe('second');
    expect(f.writes).toEqual(['selection']);
    expect(f.commands.pending.value).toBe(0);
  } finally {
    finish.resolve();
    await first;
  }
});

it('finishes both persistence steps after an admitted forget is cancelled', async () => {
  const writing = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const f = fixture({
    writeEnvironments: async () => {
      writing.resolve();
      await finish.promise;
    },
  });
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  f.writes.length = 0;
  const forgetting = f.runtime.runFork(f.environments.forget('first'));
  await writing.promise;
  const cancelled = Effect.runPromise(Fiber.interrupt(forgetting));
  finish.resolve();
  await cancelled;
  expect(f.saved().environments).toEqual([remote('second')]);
  expect(f.saved().selection).toEqual({
    currentEnvironmentId: undefined,
    selections: { second: { projectId: 'two', worktreeId: 'two-tree' } },
  });
  expect(f.writes).toEqual(['environments', 'selection']);
  expect(f.commands.pending.value).toBe(0);
});

it('refuses a stale worktree after switching to another environment', async () => {
  const f = fixture();
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  await f.runtime.runPromise(
    f.commands.execute({ kind: 'environment', environmentId: 'second' }),
  );
  f.writes.length = 0;
  const exit = await f.runtime.runPromiseExit(
    f.commands.execute({
      kind: 'worktree',
      environmentId: 'first',
      projectId: 'wrong',
      worktreeId: 'wrong-tree',
    }),
  );
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
    message: 'The selected environment changed. Open its project picker again.',
  });
  expect(f.saved().selection.currentEnvironmentId).toBe('second');
  expect(f.saved().selection.selections.first).toEqual({
    projectId: 'one',
    worktreeId: 'one-tree',
  });
  expect(f.writes).toEqual([]);
});

it('selects a workspace from another paired environment in one saved update', async () => {
  const f = fixture();
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  f.writes.length = 0;
  const exit = await f.runtime.runPromiseExit(
    f.commands.execute({
      kind: 'workspace',
      environmentId: 'second',
      projectId: 'shared-project',
      worktreeId: 'second-tree',
    }),
  );
  expect(Exit.isSuccess(exit)).toBe(true);
  expect(f.saved().selection).toEqual({
    currentEnvironmentId: 'second',
    selections: {
      first: { projectId: 'one', worktreeId: 'one-tree' },
      second: { projectId: 'shared-project', worktreeId: 'second-tree' },
    },
  });
  expect(f.writes).toEqual(['selection']);
});

it('retains pairing and workspace selections when an unsaved draft cannot be written', async () => {
  const f = fixture();
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  const draft = await f.runtime.runPromise(
    f.drafts.retain({
      environmentId: 'first',
      scope: { projectId: 'one', worktreeId: 'one-tree' },
      path: 'README.md',
      text: 'disk',
      fingerprint: 'original',
      writer: {
        write: () =>
          Effect.fail(new ConnectionError({ message: 'Disk is unavailable.' })),
      },
    }),
  );
  await f.runtime.runPromise(draft.change('unsaved edit'));
  f.writes.length = 0;
  const exit = await f.runtime.runPromiseExit(f.environments.forget('first'));
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
    message: 'Save or discard unsaved file drafts before disconnecting.',
  });
  expect(f.saved().environments).toEqual([remote('first'), remote('second')]);
  expect(f.saved().selection.currentEnvironmentId).toBe('first');
  expect(f.drafts.hasUnsaved(['first'])).toBe(true);
  expect(draft.state.value.text).toBe('unsaved edit');
  expect(f.writes).toEqual([]);
});

it('refuses to pair this computer without touching HTTP or saved credentials', async () => {
  const f = fixture();
  await f.runtime.runPromise(f.environments.read());
  const exit = await f.runtime.runPromiseExit(
    f.environments.pair({
      value: 'http://first.local:4738/pair#c=unused&e=first',
      localEnvironmentId: 'first',
    }),
  );
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
    message: 'That link is for this computer.',
  });
  expect(f.writes).toEqual([]);
  expect(f.saved().environments).toEqual([remote('first'), remote('second')]);
});

it('keeps failed workspace cleanup visible and repairs it by rereading before another choice', async () => {
  let storageAvailable = false;
  const f = fixture({
    writeSelection: () =>
      storageAvailable
        ? Promise.resolve()
        : Promise.reject(new Error('Database unavailable.')),
  });
  await f.runtime.runPromise(f.environments.read());
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  const exit = await f.runtime.runPromiseExit(f.environments.forget('first'));
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
    message:
      'Saved workspace selections could not be updated. Read them again before making changes.',
  });
  expect(f.access.state.value.remotes).toEqual([remote('second')]);
  expect(f.selection.state.value.status).toBe('unreadable');
  expect(f.saved().selection.currentEnvironmentId).toBe('first');
  const stale = await f.runtime.runPromiseExit(
    f.commands.execute({ kind: 'environment', environmentId: 'first' }),
  );
  expect(Exit.isFailure(stale) && Cause.squash(stale.cause)).toMatchObject({
    message:
      'That environment is no longer paired. Open the workspace picker again.',
  });
  storageAvailable = true;
  await f.runtime.runPromise(f.commands.execute({ kind: 'read' }));
  await f.runtime.runPromise(
    f.commands.execute({ kind: 'environment', environmentId: 'second' }),
  );
  expect(f.saved().selection).toEqual({
    currentEnvironmentId: 'second',
    selections: { second: { projectId: 'two', worktreeId: 'two-tree' } },
  });
  expect(f.commands.pending.value).toBe(0);
});
