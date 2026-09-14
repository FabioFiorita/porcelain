// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { afterEach, expect, it } from 'vitest';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import { createQueryClient } from './client';
import { useHiddenPaths, useSetHidden } from './file-preferences';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

const projectId = 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09';
const hiddenPath = 'src/hidden.ts';

function ConnectionGate({ children }: { children: ReactNode }) {
  const { api, connection, beginConnection } = useWorkspaceContext();
  useEffect(() => {
    if (connection) return;
    const controller = new AbortController();
    void api.inventory
      .read({
        token: 'fixture-token',
        signal: controller.signal,
        refresh: false,
      })
      .then((inventory) => {
        beginConnection()?.('fixture-token', inventory);
      });
    return () => controller.abort();
  }, [api, beginConnection, connection]);
  return connection ? children : <span>Connecting</span>;
}

function PreferencesHarness() {
  const hidden = useHiddenPaths(projectId);
  const setHidden = useSetHidden(projectId);
  return (
    <>
      <output aria-label="Hidden paths">{[...hidden].sort().join(',')}</output>
      <button
        type="button"
        onClick={() =>
          void setHidden
            .submit({ path: hiddenPath, hidden: true })
            .catch(() => undefined)
        }
      >
        Hide file
      </button>
      <button
        type="button"
        onClick={() =>
          void setHidden
            .submit({ path: hiddenPath, hidden: false })
            .catch(() => undefined)
        }
      >
        Show file
      </button>
      {setHidden.error ? <output>{setHidden.error.message}</output> : null}
    </>
  );
}

function renderPreferences(store = createMockStore()) {
  const api = createMockApi(store);
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <PreferencesHarness />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return { store, queryClient };
}

afterEach(() => cleanup());

it('loads project hidden paths and updates the cache from the server', async () => {
  const store = createMockStore();
  renderPreferences(store);
  const user = userEvent.setup();
  const hidden = await screen.findByLabelText('Hidden paths');
  expect(hidden.textContent).toBe('');

  await user.click(screen.getByRole('button', { name: 'Hide file' }));
  await waitFor(() => expect(hidden.textContent).toContain(hiddenPath));
  expect(store.filePreferences[projectId]).toEqual([
    { path: hiddenPath, pinned: false, hidden: true },
  ]);
});

it('keeps the cached hidden state when the server rejects a write', async () => {
  const store = createMockStore();
  store.filePreferences[projectId] = [
    { path: hiddenPath, pinned: false, hidden: true },
  ];
  const { queryClient } = renderPreferences(store);
  const user = userEvent.setup();
  const hidden = await screen.findByLabelText('Hidden paths');
  store.filePreferencesFailed = true;

  await user.click(screen.getByRole('button', { name: 'Show file' }));
  await screen.findByText(
    'File preferences could not be loaded or saved. Try again.',
  );
  expect(hidden.textContent).toContain(hiddenPath);
  expect(
    queryClient.getQueryData([
      'review',
      store.inventory.environmentId,
      projectId,
      'file-preferences',
    ]),
  ).toEqual({
    preferences: [{ path: hiddenPath, pinned: false, hidden: true }],
  });
});
