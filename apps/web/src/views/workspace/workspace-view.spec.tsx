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
  // jsdom has no native top-layer states. Its selector engine recursively delegates
  // :fullscreen/:modal back to Element.matches; Base UI checks these when focusing.
  const nativeMatches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector,
  ) {
    if ([':fullscreen', ':modal', ':popover-open'].includes(selector))
      return false;
    return nativeMatches.call(this, selector);
  });
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

describe('worktree review navigation', () => {
  it('scopes selection to each worktree and clears private review data on disconnect', async () => {
    const { queryClient } = renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: /review-panel.tsx.*staged/ }),
    );
    await screen.findByRole('heading', {
      name: 'src/components/review-panel.tsx',
    });
    await user.click(
      screen.getByRole('button', {
        name: /main.*sample-project.*Main worktree/,
      }),
    );
    await screen.findByText('All caught up');
    expect(
      screen.queryByRole('heading', {
        name: 'src/components/review-panel.tsx',
      }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByLabelText('Access token');
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
  it('recovers failed review reads and loads artifacts even for an unavailable checkout', async () => {
    const store = createMockStore('review-failed');
    renderReview(store);
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await screen.findByRole('button', { name: 'Try again' });
    store.reviewFailed = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('A clearer review experience');
    await user.click(
      screen.getByRole('button', { name: /archive\/initial-prototype/ }),
    );
    await user.click(screen.getByRole('tab', { name: 'Artifacts' }));
    await user.click(
      await screen.findByRole('button', {
        name: /Keyboard accessibility audit/,
      }),
    );
    await screen.findByRole('heading', {
      name: 'Keyboard accessibility audit',
    });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
  it('prepares an index-only mock commit, requires confirmation and refreshes authoritative changes', async () => {
    const { store } = renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(screen.getByRole('tab', { name: 'Git' }));
    await user.click(
      screen.getByRole('button', { name: /^Commit Commit the existing index/ }),
    );
    await user.type(
      screen.getByLabelText('Message'),
      'Review sidebar foundation',
    );
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    const confirm = await screen.findByRole('button', {
      name: 'Confirm commit',
    });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(store.actionCount).toBe(0);
    await user.click(
      screen.getByLabelText(
        'I have reviewed the scope and paused external writers.',
      ),
    );
    await user.click(confirm);
    await screen.findByRole('heading', { name: 'succeeded' });
    expect(store.actionCount).toBe(1);
    const data = store.review['629a8628-1cd6-4562-81a2-9c05fba76b4b'];
    expect(
      data?.status.changes.some((change) => change.scope === 'staged'),
    ).toBe(false);
    expect(
      data?.status.changes.some((change) => change.scope === 'unstaged'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Check receipt' }));
    expect(store.actionCount).toBe(1);
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await screen.findByRole('button', { name: /Review sidebar foundation/ });
  });
  it('does not repopulate a disconnected session when a slow review read finishes', async () => {
    const { store, queryClient } = renderReview();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    store.delayMs = 100;
    await user.click(screen.getByRole('button', { name: /agent\/review/ }));
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(screen.queryByText('A clearer review experience')).toBeNull();
  });
});

function renderReview(store = createMockStore()) {
  store.inventory.projects = store.inventory.projects.slice(0, 1);
  return renderWorkspace(store);
}

describe('file discussion', () => {
  it('preserves failed drafts, saves to the selected file and hides the discussion on other files', async () => {
    const { store } = renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: /review-panel.tsx.*staged/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add comment' }),
    );
    await user.type(
      screen.getByLabelText('Comment'),
      'Please explain this component.',
    );
    store.commentsFailed = true;
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Comments are unavailable',
    );
    expect(screen.getByLabelText('Comment')).toHaveProperty(
      'value',
      'Please explain this component.',
    );
    expect(Object.values(store.comments).flat()).toHaveLength(0);
    store.commentsFailed = false;
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    await screen.findByText('Please explain this component.');
    store.commentsFailed = true;
    await user.click(
      screen.getByRole('button', { name: 'Refresh discussion' }),
    );
    await screen.findByText(/Comments shown may be out of date/);
    expect(screen.getByText('Please explain this component.')).toBeTruthy();
    store.commentsFailed = false;
    expect(Object.values(store.comments).flat()[0]?.anchor).toEqual({
      kind: 'file',
      filePath: 'src/components/review-panel.tsx',
    });
    await user.click(screen.getByRole('button', { name: '1 comment' }));
    expect(screen.queryByText('Please explain this component.')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: /empty-state.tsx.*added/ }),
    );
    await screen.findByRole('button', { name: '0 comments' });
    expect(screen.queryByText('Please explain this component.')).toBeNull();
  });
});
