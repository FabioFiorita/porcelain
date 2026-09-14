// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import type { Api } from '../api/api';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { Inventory, Project } from '../domain/inventory';
import { ConnectionForm } from '../views/connection/connection-form';
import { createQueryClient } from './client';
import {
  useInventory,
  useRefreshInventory,
  useRegisterProject,
} from './inventory';
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
  const refresh = useRefreshInventory();
  const register = useRegisterProject();
  return (
    <>
      <button
        type="button"
        aria-busy={refresh.isPending}
        onClick={() => void refresh.submit()}
      >
        Refresh inventory
      </button>
      <button
        type="button"
        onClick={() => void register.submit('/srv/registered-project')}
      >
        Register project
      </button>
      <output aria-label="Projects">
        {inventory.projects.map((project) => project.name).join(', ')}
      </output>
    </>
  );
}

function Harness() {
  const { connection } = useWorkspaceContext();
  return connection ? <InventoryControls /> : <ConnectionForm />;
}

afterEach(() => cleanup());

it('keeps a registered project when an older refresh response resolves last', async () => {
  const store = createMockStore('empty');
  const base = createMockApi(store);
  const refreshResponse = deferred<Inventory>();
  const registerResponse = deferred<Project>();
  const staleInventory = structuredClone(store.inventory);
  const registeredProject: Project = {
    id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc11',
    name: 'registered-project',
    available: true,
    worktrees: [
      {
        id: '801a8628-1cd6-4562-81a2-9c05fba76b11',
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
      read: (options) =>
        options.refresh
          ? refreshResponse.promise
          : base.inventory.read(options),
      register: () => registerResponse.promise,
    },
  };
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <Harness />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Access token'),
    'fixture-token',
  );
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByRole('button', { name: 'Refresh inventory' });

  const refresh = screen.getByRole('button', { name: 'Refresh inventory' });
  await user.click(refresh);
  await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('true'));
  await user.click(screen.getByRole('button', { name: 'Register project' }));
  registerResponse.resolve(registeredProject);

  const projects = screen.getByLabelText('Projects');
  await waitFor(() =>
    expect(projects.textContent).toContain('registered-project'),
  );

  refreshResponse.resolve(staleInventory);
  await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('false'));
  expect(projects.textContent).toContain('registered-project');
});
