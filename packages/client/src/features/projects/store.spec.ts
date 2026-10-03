import { describe, expect, it } from 'vitest';
import { createProjectSelectionStore } from './store.ts';
import type { ProjectSelectionSnapshot } from '@porcelain/client/projects';

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
    const store = createProjectSelectionStore(storage);
    await store.getState().load();
    await store.getState().selectEnvironment('first');
    await store
      .getState()
      .selectWorktree('first', 'first-project', 'first-tree');
    await store.getState().selectEnvironment('second');
    await store
      .getState()
      .selectWorktree('second', 'second-project', 'second-tree');
    await store.getState().selectEnvironment('first');
    const restored = createProjectSelectionStore(storage);
    await restored.getState().load();
    expect(restored.getState().currentEnvironmentId).toBe('first');
    expect(restored.getState().selections).toEqual({
      first: { projectId: 'first-project', worktreeId: 'first-tree' },
      second: { projectId: 'second-project', worktreeId: 'second-tree' },
    });
  });

  it('rejects a stale worktree choice after changing environment', async () => {
    const persisted: ProjectSelectionSnapshot[] = [];
    const store = createProjectSelectionStore({
      read: () =>
        Promise.resolve({ currentEnvironmentId: 'second', selections: {} }),
      write: (snapshot) => {
        persisted.push(snapshot);
        return Promise.resolve();
      },
    });
    await store.getState().load();
    await expect(
      store.getState().selectWorktree('first', 'project', 'tree'),
    ).rejects.toThrow('environment changed');
    expect(store.getState().currentEnvironmentId).toBe('second');
    expect(store.getState().selections).toEqual({});
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
    const store = createProjectSelectionStore({
      read: () => Promise.resolve(saved),
      write: (snapshot) => {
        saved = snapshot;
        return Promise.resolve();
      },
    });
    await store.getState().load();
    await store.getState().forgetEnvironment('first');
    expect(saved).toEqual({
      currentEnvironmentId: undefined,
      selections: { second: { projectId: 'two', worktreeId: 'tree-two' } },
    });
    await store.getState().selectEnvironment('second');
    await store.getState().forgetEnvironment('first');
    expect(store.getState().currentEnvironmentId).toBe('second');
    expect(store.getState().selections.second).toEqual({
      projectId: 'two',
      worktreeId: 'tree-two',
    });
  });

  it('publishes each choice only after saving it and serializes concurrent choices', async () => {
    const initial = { currentEnvironmentId: undefined, selections: {} };
    const observed: (string | undefined)[] = [];
    const persisted: ProjectSelectionSnapshot[] = [];
    const store = createProjectSelectionStore({
      read: () => Promise.resolve(initial),
      write: async (snapshot) => {
        observed.push(store.getState().currentEnvironmentId);
        await Promise.resolve();
        persisted.push(snapshot);
      },
    });
    await store.getState().load();
    await Promise.all([
      store.getState().selectEnvironment('first'),
      store.getState().selectWorktree('first', 'project', 'tree'),
      store.getState().selectEnvironment('second'),
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
    const store = createProjectSelectionStore({
      read: () => Promise.resolve(saved),
      write: () => {
        writes += 1;
        return Promise.reject(new Error('private storage failure'));
      },
    });
    await store.getState().load();
    await expect(store.getState().selectEnvironment('second')).rejects.toThrow(
      'updated',
    );
    expect(store.getState().currentEnvironmentId).toBe('first');
    expect(store.getState().status).toBe('unreadable');
    await expect(store.getState().forgetEnvironment('first')).rejects.toThrow(
      'read',
    );
    expect(writes).toBe(1);
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
  });

  it('refuses to overwrite unreadable selections or write before their first read', async () => {
    let writes = 0;
    const store = createProjectSelectionStore({
      read: () => Promise.reject(new Error('private storage detail')),
      write: () => {
        writes += 1;
        return Promise.resolve();
      },
    });
    await expect(store.getState().selectEnvironment('first')).rejects.toThrow(
      'read',
    );
    await store.getState().load();
    expect(store.getState().error).toBe(
      'Saved workspace selections could not be read. Try reading them again.',
    );
    await expect(store.getState().selectEnvironment('first')).rejects.toThrow(
      'read',
    );
    expect(writes).toBe(0);
  });
});
