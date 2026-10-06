import { Cause, Effect, Fiber } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectSelectionStore } from './store.ts';
import { ProjectSelectionStorage } from '@porcelain/client/projects';
import type { ProjectSelectionSnapshot } from '@porcelain/client/projects';

function fixture(storage: {
  read: () => Promise<ProjectSelectionSnapshot>;
  write: (value: ProjectSelectionSnapshot) => Promise<void>;
}) {
  return Effect.runSync(
    ProjectSelectionStore.pipe(
      Effect.provide(ProjectSelectionStore.layer),
      Effect.provideService(ProjectSelectionStorage, {
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

describe('remembered workspaces', () => {
  it('restores each environment selection after switching and restarting', async () => {
    let saved: ProjectSelectionSnapshot = {
      currentEnvironmentId: undefined,
      selections: {},
    };
    const storage = {
      read: () => Promise.resolve(saved),
      write: (snapshot: ProjectSelectionSnapshot) => {
        saved = snapshot;
        return Promise.resolve();
      },
    };
    const store = fixture(storage);
    await Effect.runPromise(store.load());
    await Effect.runPromise(store.selectEnvironment('first'));
    await Effect.runPromise(
      store.selectWorktree('first', 'first-project', 'first-tree'),
    );
    await Effect.runPromise(store.selectEnvironment('second'));
    await Effect.runPromise(
      store.selectWorktree('second', 'second-project', 'second-tree'),
    );
    await Effect.runPromise(store.selectEnvironment('first'));
    const restored = fixture(storage);
    await Effect.runPromise(restored.load());
    expect(restored.state.value.currentEnvironmentId).toBe('first');
    expect(restored.state.value.selections).toEqual({
      first: { projectId: 'first-project', worktreeId: 'first-tree' },
      second: { projectId: 'second-project', worktreeId: 'second-tree' },
    });
  });

  it('rejects a stale worktree choice after changing environment', async () => {
    const persisted: ProjectSelectionSnapshot[] = [];
    const store = fixture({
      read: () =>
        Promise.resolve({ currentEnvironmentId: 'second', selections: {} }),
      write: (snapshot) => {
        persisted.push(snapshot);
        return Promise.resolve();
      },
    });
    await Effect.runPromise(store.load());
    await expect(
      Effect.runPromise(store.selectWorktree('first', 'project', 'tree')),
    ).rejects.toThrow('environment changed');
    expect(store.state.value.currentEnvironmentId).toBe('second');
    expect(store.state.value.selections).toEqual({});
    expect(persisted).toEqual([]);
  });

  it('forgets only the removed environment and clears its active reference', async () => {
    let saved: ProjectSelectionSnapshot = {
      currentEnvironmentId: 'first',
      selections: {
        first: { projectId: 'one', worktreeId: 'tree-one' },
        second: { projectId: 'two', worktreeId: 'tree-two' },
      },
    };
    const store = fixture({
      read: () => Promise.resolve(saved),
      write: (snapshot) => {
        saved = snapshot;
        return Promise.resolve();
      },
    });
    await Effect.runPromise(store.load());
    await Effect.runPromise(store.forgetEnvironment('first'));
    expect(saved).toEqual({
      currentEnvironmentId: undefined,
      selections: { second: { projectId: 'two', worktreeId: 'tree-two' } },
    });
    await Effect.runPromise(store.selectEnvironment('second'));
    await Effect.runPromise(store.forgetEnvironment('first'));
    expect(store.state.value.currentEnvironmentId).toBe('second');
    expect(store.state.value.selections.second).toEqual({
      projectId: 'two',
      worktreeId: 'tree-two',
    });
  });

  it('publishes each choice only after saving it and serializes concurrent choices', async () => {
    const initial = { currentEnvironmentId: undefined, selections: {} };
    const observed: (string | undefined)[] = [];
    const persisted: ProjectSelectionSnapshot[] = [];
    const store = fixture({
      read: () => Promise.resolve(initial),
      write: async (snapshot) => {
        observed.push(store.state.value.currentEnvironmentId);
        await Promise.resolve();
        persisted.push(snapshot);
      },
    });
    await Effect.runPromise(store.load());
    await Promise.all([
      Effect.runPromise(store.selectEnvironment('first')),
      Effect.runPromise(store.selectWorktree('first', 'project', 'tree')),
      Effect.runPromise(store.selectEnvironment('second')),
    ]);
    expect(observed).toEqual([undefined, 'first', 'first']);
    expect(persisted.at(-1)).toEqual({
      currentEnvironmentId: 'second',
      selections: { first: { projectId: 'project', worktreeId: 'tree' } },
    });
  });

  it('keeps the last saved selection and blocks changes until a failed write is reread', async () => {
    let writes = 0;
    const saved = { currentEnvironmentId: 'first', selections: {} };
    const store = fixture({
      read: () => Promise.resolve(saved),
      write: () => {
        writes += 1;
        return Promise.reject(new Error('private storage failure'));
      },
    });
    await Effect.runPromise(store.load());
    await expect(
      Effect.runPromise(store.selectEnvironment('second')),
    ).rejects.toThrow('updated');
    expect(store.state.value.currentEnvironmentId).toBe('first');
    expect(store.state.value.status).toBe('unreadable');
    await expect(
      Effect.runPromise(store.forgetEnvironment('first')),
    ).rejects.toThrow('read');
    expect(writes).toBe(1);
    await Effect.runPromise(store.load());
    expect(store.state.value.status).toBe('ready');
  });

  it('refuses to overwrite unreadable selections or write before their first read', async () => {
    let writes = 0;
    const store = fixture({
      read: () => Promise.reject(new Error('private storage detail')),
      write: () => {
        writes += 1;
        return Promise.resolve();
      },
    });
    await expect(
      Effect.runPromise(store.selectEnvironment('first')),
    ).rejects.toThrow('read');
    await Effect.runPromise(store.load());
    expect(store.state.value.error).toBe(
      'Saved workspace selections could not be read. Try reading them again.',
    );
    await expect(
      Effect.runPromise(store.selectEnvironment('first')),
    ).rejects.toThrow('read');
    expect(writes).toBe(0);
  });
});

it('retains an admitted selection when cancelled during persistence and uses it for the next choice', async () => {
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const writes: ProjectSelectionSnapshot[] = [];
  const store = fixture({
    read: () =>
      Promise.resolve({ currentEnvironmentId: undefined, selections: {} }),
    write: async (snapshot) => {
      writes.push(snapshot);
      if (writes.length === 1) {
        started.resolve();
        await finish.promise;
      }
    },
  });
  await Effect.runPromise(store.load());
  const selecting = Effect.runFork(store.selectEnvironment('first'));
  await started.promise;
  const cancelled = Effect.runPromise(Fiber.interrupt(selecting));
  expect(store.state.value.currentEnvironmentId).toBeUndefined();
  finish.resolve();
  await cancelled;
  expect(store.state.value.currentEnvironmentId).toBe('first');
  await Effect.runPromise(store.selectWorktree('first', 'project', 'tree'));
  expect(writes).toEqual([
    { currentEnvironmentId: 'first', selections: {} },
    {
      currentEnvironmentId: 'first',
      selections: { first: { projectId: 'project', worktreeId: 'tree' } },
    },
  ]);
});
