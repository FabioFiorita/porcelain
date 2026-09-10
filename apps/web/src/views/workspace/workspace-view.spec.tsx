// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createMockStore } from '../../api/inventory/mock';
import { renderWorkspace } from '../../test/render';

// The development overlay has its own browser smoke; it is not supported by jsdom.
vi.mock('../../development/devtools', () => ({ Devtools: () => null }));
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(cleanup);
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function connect() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Access token'),
    'fixture-token',
  );
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  return user;
}

describe('workspace through the inventory port', () => {
  it('refreshes authoritative inventory and clears cached data on disconnect', async () => {
    const { store, queryClient } = renderWorkspace();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    const project = store.inventory.projects[0];
    if (!project) throw new Error('Missing fixture project');
    project.name = 'Renamed project';
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByRole('heading', { name: 'Renamed project' });
    expect(store.refreshCount).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByLabelText('Access token');
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(screen.queryByText('Renamed project')).toBeNull();
  });

  it('retains inventory after failed refresh and recovers on retry', async () => {
    const store = createMockStore('refresh-failed');
    renderWorkspace(store);
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'out of date',
    );
    expect(
      screen.getByRole('heading', { name: 'Porcelain', level: 3 }),
    ).toBeTruthy();
    store.refreshFailed = false;
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('rejects inventory from a different environment without replacing current data', async () => {
    const { store } = renderWorkspace();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    store.inventory.environmentId = '641a8628-1cd6-4562-81a2-9c05fba76b4a';
    store.inventory.projects = [];
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'environment changed',
    );
    expect(
      screen.getByRole('heading', { name: 'Porcelain', level: 3 }),
    ).toBeTruthy();
  });

  it('shows a rejected connection without caching private inventory', async () => {
    const { queryClient } = renderWorkspace(createMockStore('rejected'));
    await connect();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'rejected',
    );
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
});
