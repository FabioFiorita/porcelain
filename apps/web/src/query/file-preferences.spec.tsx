import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { createMockStore, mockEnvironmentId } from '../api/inventory/mock';
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
    // Connect the way a browser does: redeem a link, then hold the cookie.
    void api.pairing
      .redeem({
        code: 'fixture-code',
        environmentId: mockEnvironmentId,
        signal: controller.signal,
      })
      .then((inventory) => {
        beginConnection()?.(inventory);
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

async function renderPreferences(store = createMockStore()) {
  const api = createMockApi(store);
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <PreferencesHarness />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return { store, queryClient, screen };
}

it('loads project hidden paths and updates the cache from the server', async () => {
  const store = createMockStore();
  const { screen } = await renderPreferences(store);
  const hidden = screen.getByLabelText('Hidden paths');
  await expect.element(hidden).toHaveTextContent('');

  await screen.getByRole('button', { name: 'Hide file' }).click();
  await expect.element(hidden).toMatchTextContent(hiddenPath);
  expect(store.filePreferences[projectId]).toEqual([
    { path: hiddenPath, pinned: false, hidden: true },
  ]);
});

it('keeps the cached hidden state when the server rejects a write', async () => {
  const store = createMockStore();
  store.filePreferences[projectId] = [
    { path: hiddenPath, pinned: false, hidden: true },
  ];
  const { queryClient, screen } = await renderPreferences(store);
  const hidden = screen.getByLabelText('Hidden paths');
  store.filePreferencesFailed = true;

  await screen.getByRole('button', { name: 'Show file' }).click();
  await expect
    .element(
      screen.getByText(
        'File preferences could not be loaded or saved. Try again.',
      ),
    )
    .toBeVisible();
  await expect.element(hidden).toMatchTextContent(hiddenPath);
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
