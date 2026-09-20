import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Api } from '../api/api';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import { FileDraft } from '../domain/file-draft';
import type { Inventory, Project } from '../domain/inventory';
import { NotPaired } from '../views/connection/not-paired';
import { createQueryClient } from './client';
import { retainedFileDrafts } from './file-drafts';
import {
  useInventory,
  useRegisterProject,
  useRemoveProject,
} from './inventory';
import { queryKeys } from './keys';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function InventoryControls() {
  const inventory = useInventory();
  const register = useRegisterProject();
  const remove = useRemoveProject();
  return (
    <>
      <button
        type="button"
        onClick={() => void register.submit('/srv/registered-project')}
      >
        Register project
      </button>
      <button
        type="button"
        onClick={() => {
          const project = inventory.projects[0];
          if (project) void remove.submit(project.id).catch(() => {});
        }}
      >
        Remove first project
      </button>
      {remove.error && <p role="alert">{remove.error.message}</p>}
      <output aria-label="Projects">
        {inventory.projects.map((project) => project.name).join(', ')}
      </output>
    </>
  );
}

function Harness() {
  const { connection } = useWorkspaceContext();
  return connection ? <InventoryControls /> : <NotPaired />;
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

it('keeps a registered project when an older focus refresh resolves last', async () => {
  const store = createMockStore('empty');
  const base = createMockApi(store);
  const refreshResponse = deferred<Inventory>();
  let held = false;
  const refreshStarted = deferred<void>();
  const registerResponse = deferred<Project>();
  const registerStarted = deferred<void>();
  const staleInventory = structuredClone(store.inventory);
  const registeredProject: Project = {
    id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc11',
    name: 'registered-project',
    available: true,
    worktrees: [
      {
        id: '801a86281cd6456281a29c05fba76b11',
        path: '/srv/registered-project',
        branch: 'refs/heads/main',
        main: true,
        available: true,
      },
    ],
  };
  const api: Api = {
    ...base,
    inventory: {
      ...base.inventory,
      read: (options) => {
        if (held) return base.inventory.read(options);
        held = true;
        refreshStarted.resolve();
        return refreshResponse.promise;
      },
      register: () => {
        registerStarted.resolve();
        return registerResponse.promise;
      },
    },
  };
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <Harness />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await expect
    .element(screen.getByRole('button', { name: 'Register project' }))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Register project' }).click();
  await registerStarted.promise;
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await refreshStarted.promise;
  registerResponse.resolve(registeredProject);

  const projects = screen.getByLabelText('Projects');
  await expect.element(projects).toMatchTextContent('registered-project');

  refreshResponse.resolve(staleInventory);
  await vi.waitFor(() =>
    expect(
      queryClient.getQueryState(
        queryKeys.inventory(store.inventory.environmentId),
      )?.fetchStatus,
    ).toBe('idle'),
  );
  await expect.element(projects).toMatchTextContent('registered-project');
});

it('does not resurrect a removed project from a late refresh and clears only its review cache', async () => {
  const store = createMockStore();
  const [removed, retained] = store.inventory.projects;
  if (!removed || !retained) throw new Error('Missing fixture projects');
  const base = createMockApi(store);
  const stale = structuredClone(store.inventory);
  const refreshResponse = deferred<Inventory>();
  const refreshStarted = deferred<void>();
  let held = false;
  const removeResponse = deferred<{ deleted: boolean }>();
  const removeStarted = deferred<void>();
  const api: Api = {
    ...base,
    inventory: {
      ...base.inventory,
      read: (options) => {
        if (held) return base.inventory.read(options);
        held = true;
        refreshStarted.resolve();
        return refreshResponse.promise;
      },
      remove: () => {
        removeStarted.resolve();
        return removeResponse.promise;
      },
    },
  };
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <Harness />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await expect
    .element(screen.getByRole('button', { name: 'Remove first project' }))
    .toBeVisible();
  const removedKey = [
    ...queryKeys.reviewProject(store.inventory.environmentId, removed.id),
    'fixture',
  ];
  const retainedKey = [
    ...queryKeys.reviewProject(store.inventory.environmentId, retained.id),
    'fixture',
  ];
  queryClient.setQueryData(removedKey, 'removed review');
  queryClient.setQueryData(retainedKey, 'retained review');
  await screen.getByRole('button', { name: 'Remove first project' }).click();
  await removeStarted.promise;
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await refreshStarted.promise;
  removeResponse.resolve({ deleted: true });
  await expect
    .element(screen.getByLabelText('Projects'))
    .not.toMatchTextContent(removed.name);
  refreshResponse.resolve(stale);
  await vi.waitFor(() =>
    expect(
      queryClient.getQueryState(
        queryKeys.inventory(store.inventory.environmentId),
      )?.fetchStatus,
    ).toBe('idle'),
  );
  await expect
    .element(screen.getByLabelText('Projects'))
    .not.toMatchTextContent(removed.name);
  expect(queryClient.getQueryData(removedKey)).toBeUndefined();
  expect(queryClient.getQueryData(retainedKey)).toBe('retained review');
});

it('saves only the removed project drafts and blocks removal if saving fails', async () => {
  const store = createMockStore();
  const [removed, retained] = store.inventory.projects;
  if (!removed || !retained) throw new Error('Missing fixture projects');
  const base = createMockApi(store);
  const remove = vi.fn(base.inventory.remove);
  const save = vi
    .fn<() => Promise<string>>()
    .mockRejectedValue(new Error('Offline'));
  const unrelatedSave = vi.fn<() => Promise<string>>();
  const draft = new FileDraft('before', 'original', save);
  draft.change('local edits');
  const unrelated = new FileDraft('before', 'original', unrelatedSave);
  unrelated.change('other edits');
  function DraftHarness() {
    const { connection } = useWorkspaceContext();
    if (!connection) return <NotPaired />;
    const entries = retainedFileDrafts(connection);
    entries.set(`${JSON.stringify([removed?.id, 'worktree'])}/file.txt`, draft);
    entries.set(
      `${JSON.stringify([retained?.id, 'worktree'])}/file.txt`,
      unrelated,
    );
    return <InventoryControls />;
  }
  const screen = await render(
    <QueryClientProvider client={createQueryClient()}>
      <WorkspaceProvider
        api={{ ...base, inventory: { ...base.inventory, remove } }}
      >
        <DraftHarness />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await screen.getByRole('button', { name: 'Remove first project' }).click();
  await expect
    .element(screen.getByRole('alert'))
    .toMatchTextContent('Save or discard');
  expect(remove).not.toHaveBeenCalled();
  await expect
    .element(screen.getByLabelText('Projects'))
    .toMatchTextContent(removed.name);
  expect(unrelatedSave).not.toHaveBeenCalled();
  save.mockResolvedValue('saved');
  await screen.getByRole('button', { name: 'Remove first project' }).click();
  await expect
    .element(screen.getByLabelText('Projects'))
    .not.toMatchTextContent(removed.name);
  expect(draft.snapshot().savedText).toBe('local edits');
  expect(remove).toHaveBeenCalledOnce();
  expect(unrelatedSave).not.toHaveBeenCalled();
});

it('rescans repositories after connecting from the stored snapshot', async () => {
  const store = createMockStore('empty');
  const base = createMockApi(store);
  const discoveredProject: Project = {
    id: '5d0c6c1f-6a0b-4f2a-9a57-2f1f3f3b8c21',
    name: 'discovered-project',
    available: true,
    worktrees: [
      {
        id: '0b1de0a40f0c4a638d5e6c3a0a4b9d31',
        path: '/srv/discovered-project',
        branch: 'refs/heads/main',
        main: true,
        available: true,
      },
    ],
  };
  // Session restore seeds the cache from the stored snapshot; the query then
  // reads, which lists live and finds the project that appeared on disk.
  const api: Api = {
    ...base,
    inventory: {
      ...base.inventory,
      read: async (options) => {
        const inventory = await base.inventory.read(options);
        return {
          ...inventory,
          projects: [...inventory.projects, discoveredProject],
        };
      },
    },
  };
  const screen = await render(
    <QueryClientProvider client={createQueryClient()}>
      <WorkspaceProvider api={api}>
        <Harness />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );

  await expect
    .element(screen.getByLabelText('Projects'))
    .toMatchTextContent('discovered-project');
});
