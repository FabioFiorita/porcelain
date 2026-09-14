// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
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
import type { Inventory } from '../../domain/inventory';
import { queryKeys } from '../../query/keys';
import { renderWorkspace } from '../../test/render';

// The development overlay has its own browser smoke; it is not supported by jsdom.
vi.mock('../../development/devtools', () => ({ Devtools: () => null }));
// Pierre owns a browser custom element and worker-backed highlighting. Its
// adapter behavior is covered separately; workspace tests exercise navigation.
vi.mock('@pierre/diffs/react', () => ({
  CodeView: ({
    items,
    renderCodeViewHeader,
  }: {
    items: Array<{ id: string }>;
    renderCodeViewHeader?: () => React.ReactNode;
  }) => (
    <div data-testid="code-view">
      {renderCodeViewHeader?.()}
      {items.map((item) => (
        <div key={item.id} data-code-item={item.id} />
      ))}
    </div>
  ),
  File: ({ file }: { file: { contents: string } }) => (
    <pre>{file.contents}</pre>
  ),
  PatchDiff: ({ patch }: { patch: string }) => <pre>{patch}</pre>,
  Virtualizer: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@pierre/trees/react', async () => {
  const { useRef } = await import('react');
  type TreeModel = {
    paths: readonly string[];
    select: (path: string) => void;
    getItem: (path: string) => {
      isDirectory: () => boolean;
      isExpanded: () => boolean;
      expand: () => void;
      select: () => void;
    } | null;
    resetPaths: (paths: readonly string[]) => void;
    setGitStatus: () => void;
    subscribe: () => () => void;
  };
  return {
    useFileTree: (options: {
      paths: readonly string[];
      onSelectionChange: (paths: readonly string[]) => void;
    }) => {
      const model = useRef<TreeModel>(null);
      model.current ??= {
        paths: options.paths,
        select: (path) => options.onSelectionChange([path]),
        getItem: (path) => ({
          isDirectory: () => path.endsWith('/'),
          isExpanded: () => false,
          expand() {},
          select() {},
        }),
        resetPaths(paths) {
          this.paths = paths;
        },
        setGitStatus() {},
        subscribe: () => () => {},
      };
      model.current.paths = options.paths;
      model.current.select = (path) => options.onSelectionChange([path]);
      return { model: model.current };
    },
    FileTree: ({ model }: { model: TreeModel }) => (
      <nav aria-label="Worktree files">
        {model.paths
          .filter((path) => !path.endsWith('/'))
          .map((path) => (
            <button key={path} type="button" onClick={() => model.select(path)}>
              {path}
            </button>
          ))}
      </nav>
    ),
  };
});
// Layout behavior is covered in the browser. Keep review navigation interactive
// without depending on panel measurements that jsdom cannot provide.
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({
    children,
    orientation: _orientation,
    ...props
  }: React.ComponentProps<'div'> & { orientation?: string }) => (
    <div {...props}>{children}</div>
  ),
  ResizablePanel: ({
    children,
    defaultSize: _defaultSize,
    minSize: _minSize,
    maxSize: _maxSize,
    ...props
  }: React.ComponentProps<'div'> & {
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }) => <div {...props}>{children}</div>,
  ResizableHandle: (props: React.ComponentProps<'div'>) => <div {...props} />,
}));
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
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 1280px'),
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
afterEach(() => {
  cleanup();
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('porcelain.tabs.')) localStorage.removeItem(key);
  }
});
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
  it('restores an authenticated connection after remount and forgets it on disconnect', async () => {
    const first = renderWorkspace();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    first.unmount();
    const second = renderWorkspace(first.store);
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    second.unmount();
    renderWorkspace(first.store);
    await screen.findByLabelText('Access token');
    expect(
      screen.queryByRole('heading', { name: 'Porcelain', level: 3 }),
    ).toBeNull();
  });

  it('reports failed logout and lets the user retry before forgetting the session', async () => {
    const { store } = renderWorkspace();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    store.disconnectFailed = true;
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not disconnect',
    );
    expect(store.sessionToken).toBe('fixture-token');
    store.disconnectFailed = false;
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByLabelText('Access token');
    expect(store.sessionToken).toBe('');
  });

  it('keeps manual login available when the saved token is rejected', async () => {
    const first = renderWorkspace();
    await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    first.unmount();
    const store = createMockStore('rejected');
    store.sessionToken = 'fixture-token';
    const second = renderWorkspace(store);
    await connect();
    await screen.findByRole('alert');
    expect(second.queryClient.getQueryCache().getAll()).toEqual([]);
    store.rejected = false;
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
  });

  it('does not restore a saved session after its provider unmounts', async () => {
    const first = renderWorkspace();
    await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    first.unmount();
    const store = createMockStore();
    store.sessionToken = 'fixture-token';
    store.delayMs = 50;
    const restoring = renderWorkspace(store);
    restoring.unmount();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(restoring.queryClient.getQueryCache().getAll()).toEqual([]);
  });

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

  it('opens a server-side project, updates inventory, and selects its first available worktree', async () => {
    const { store, queryClient } = renderWorkspace();
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    await user.click(screen.getByRole('button', { name: 'Open project' }));
    await user.type(
      await screen.findByLabelText('Repository path'),
      '/srv/work/new-project',
    );
    await user.click(screen.getByRole('button', { name: 'Open project' }));

    const project = await waitFor(() =>
      store.inventory.projects.find(
        (entry) => entry.worktrees[0]?.path === '/srv/work/new-project',
      ),
    );
    const worktree = project?.worktrees.find((entry) => entry.available);
    expect(worktree).toBeDefined();
    expect(
      queryClient.getQueryData<Inventory>(
        queryKeys.inventory(store.inventory.environmentId),
      )?.projects,
    ).toContainEqual(project);
    expect(
      (
        await screen.findByRole('button', { name: /main.*new-project/ })
      ).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('keeps the server path in the form after registration fails', async () => {
    const store = createMockStore();
    store.registerFailed = true;
    renderWorkspace(store);
    const user = await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    await user.click(screen.getByRole('button', { name: 'Open project' }));
    const path = '/srv/work/missing-repository';
    const input = await screen.findByLabelText('Repository path');
    await user.type(input, path);
    await user.click(screen.getByRole('button', { name: 'Open project' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be opened on the Porcelain server',
    );
    expect(input).toHaveProperty('value', path);
    expect(
      store.inventory.projects.some((project) =>
        project.worktrees.some((worktree) => worktree.path === path),
      ),
    ).toBe(false);
  });
});

describe('worktree review navigation', () => {
  it('opens the initial handoff when tab storage is unavailable', async () => {
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(function (this: Storage, key: string) {
        if (key.startsWith('porcelain.tabs.'))
          throw new DOMException('Storage denied', 'SecurityError');
        return originalGetItem.call(this, key);
      });
    renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await screen.findByRole('heading', { name: 'Review handoff' });
    getItem.mockRestore();
  });

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
    await screen.findByText('No changes to review');
    expect(
      screen.queryByRole('heading', {
        name: 'src/components/review-panel.tsx',
      }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByLabelText('Access token');
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
  it('recovers failed review reads without adding unsupported navigation surfaces', async () => {
    const store = createMockStore();
    store.changesFailed = true;
    renderReview(store);
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    const sidebar = screen.getByTestId('review-sidebar');
    expect(
      within(sidebar).getAllByRole('tab', {
        name: /^(Changes|Files|History)$/,
      }),
    ).toHaveLength(3);
    await user.click(within(sidebar).getByRole('tab', { name: 'Files' }));
    await screen.findByRole('button', { name: /README\.md/ });
    await user.click(within(sidebar).getByRole('tab', { name: 'Changes' }));
    const failedReviewRetries = await screen.findAllByRole('button', {
      name: 'Try again',
    });
    expect(failedReviewRetries.length).toBeGreaterThan(0);
    store.changesFailed = false;
    const firstFailedReviewRetry = failedReviewRetries[0];
    if (!firstFailedReviewRetry) throw new Error('Missing review retry');
    await user.click(firstFailedReviewRetry);
    const remainingReviewRetries = screen.queryAllByRole('button', {
      name: 'Try again',
    });
    if (remainingReviewRetries[0]) {
      await user.click(remainingReviewRetries[0]);
    }
    expect(
      (
        await screen.findAllByRole('button', {
          name: /A clearer review experience/,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('tab', { name: 'Artifacts' })).toBeNull();
    expect(
      within(sidebar).getAllByRole('tab', {
        name: /^(Review|Files|History)$/,
      }),
    ).toHaveLength(3);
  });
  it('keeps file documents and Git controls available when artifacts fail', async () => {
    const store = createMockStore();
    store.artifactsFailed = true;
    renderReview(store);
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    const sidebar = screen.getByTestId('review-sidebar');
    await user.click(within(sidebar).getByRole('tab', { name: 'Files' }));
    await user.click(
      await within(sidebar).findByRole('button', { name: /README\.md/ }),
    );

    await screen.findByRole('heading', { name: 'README.md' });
    expect(screen.getByRole('button', { name: 'Git actions' })).toBeTruthy();
  });
  it('keeps stored artifacts reachable for an unavailable worktree', async () => {
    renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /archive\/initial-prototype/ }),
    );
    await screen.findByText('Stored agent reports');
    await user.click(
      within(screen.getByTestId('review-sidebar')).getByRole('button', {
        name: /Keyboard accessibility audit/,
      }),
    );
    expect(
      await screen.findAllByRole('heading', {
        name: 'Keyboard accessibility audit',
      }),
    ).toHaveLength(2);
  });
  it('renders the report in an opaque-origin sandboxed frame', async () => {
    renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: /The whole handoff/ }),
    );
    const reportButtons = await screen.findAllByRole('button', {
      name: /Launch review report/,
    });
    await user.click(reportButtons[0] as HTMLButtonElement);

    await screen.findByRole('heading', { name: 'Launch review report' });
    const frame = await screen.findByTitle('Launch review report');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('srcdoc')).toContain('Fieldnotes launch review');
  });
  it.each([false, true])(
    'commits only staged changes and recovers without repeating the action (lost response: %s)',
    async (loseResponse) => {
      const { store } = renderReview();
      const user = await connect();
      await user.click(
        await screen.findByRole('button', { name: /agent\/review/ }),
      );
      await user.click(
        await screen.findByRole('button', { name: 'Git actions' }),
      );
      await user.click(
        await screen.findByRole('menuitem', {
          name: /^Commit Commit the existing index/,
        }),
      );
      await user.type(
        await screen.findByLabelText('Message'),
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
      store.loseActionResponse = loseResponse;
      await user.click(confirm);
      if (loseResponse) {
        await screen.findByRole('heading', {
          name: 'Outcome not yet confirmed',
        });
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(
          screen.queryByRole('button', { name: 'Prepare another action' }),
        ).toBeNull();
        await user.click(await screen.findByRole('tab', { name: 'Files' }));
        await user.click(
          await screen.findByRole('button', { name: 'Git actions' }),
        );
        await user.click(
          await screen.findByRole('menuitem', { name: /^Commit Commit/ }),
        );
        await screen.findByRole('heading', {
          name: 'Outcome not yet confirmed',
        });
        await user.click(screen.getByRole('button', { name: 'Check receipt' }));
      }
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
      if (screen.queryByRole('button', { name: 'Close' })) {
        await user.click(screen.getByRole('button', { name: 'Close' }));
      }
      await user.click(await screen.findByRole('tab', { name: 'History' }));
      await screen.findByRole('button', { name: /Review sidebar foundation/ });
    },
  );
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
      screen.getByRole('button', { name: /empty-state.tsx.*staged/ }),
    );
    await screen.findByRole('button', { name: '0 comments' });
    expect(screen.queryByText('Please explain this component.')).toBeNull();
  });
});

describe('git actions', () => {
  async function openAction(name: RegExp) {
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Git actions' }),
    );
    await user.click(await screen.findByRole('menuitem', { name }));
    return user;
  }

  async function confirmPrepared(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByLabelText(
        'I have reviewed the scope and paused external writers.',
      ),
    );
  }

  it('prepares a push with its remote destination and confirms it', async () => {
    const { store } = renderReview();
    const user = await openAction(/^Push Send committed changes/);
    expect(screen.getByLabelText('Configured remote')).toHaveProperty(
      'value',
      'origin',
    );
    await user.click(screen.getByLabelText('Allow creating the remote branch'));
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    await screen.findByText('Destination');
    expect(screen.getByText('Mock origin')).toBeTruthy();
    await confirmPrepared(user);
    await user.click(screen.getByRole('button', { name: 'Confirm push' }));
    await screen.findByRole('heading', { name: 'succeeded' });
    expect(store.actionCount).toBe(1);
  });

  it('reports a preparation the environment refuses without starting an operation', async () => {
    const { store } = renderReview();
    const user = await openAction(/^Apply stash Restore a stash and keep it/);
    await user.type(
      screen.getByLabelText('Full stash object ID'),
      'a'.repeat(40),
    );
    await user.click(screen.getByLabelText('Restore index'));
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'not simulated in this mock',
    );
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(store.actionCount).toBe(0);
  });

  it('returns a prepared action to editing without executing it', async () => {
    const { store } = renderReview();
    const user = await openAction(/^Commit Commit the existing index/);
    await user.type(screen.getByLabelText('Message'), 'Prepared then edited');
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    await confirmPrepared(user);
    await user.click(screen.getByRole('button', { name: 'Edit preparation' }));
    await screen.findByRole('button', { name: 'Prepare action' });
    expect(screen.queryByRole('button', { name: 'Confirm commit' })).toBeNull();
    expect(screen.getByLabelText('Message')).toHaveProperty(
      'value',
      'Prepared then edited',
    );
    expect(store.actionCount).toBe(0);
  });

  it('blocks confirmation once the preparation has expired', async () => {
    renderReview();
    const user = await openAction(/^Commit Commit the existing index/);
    await user.type(screen.getByLabelText('Message'), 'Too late');
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    const confirm = await screen.findByRole('button', {
      name: 'Confirm commit',
    });
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 600_000);
    try {
      await confirmPrepared(user);
      expect(confirm.hasAttribute('disabled')).toBe(true);
    } finally {
      vi.mocked(Date.now).mockRestore();
    }
  });

  it('reports a commit with nothing staged and allows preparing another action', async () => {
    const { store } = renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', {
        name: /main.*sample-project.*Main worktree/,
      }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Git actions' }),
    );
    await user.click(
      await screen.findByRole('menuitem', {
        name: /^Commit Commit the existing index/,
      }),
    );
    await user.type(await screen.findByLabelText('Message'), 'Nothing staged');
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    await confirmPrepared(user);
    await user.click(screen.getByRole('button', { name: 'Confirm commit' }));
    await screen.findByRole('heading', { name: 'no-change' });
    expect(store.actionCount).toBe(1);
    await user.click(
      screen.getByRole('button', { name: 'Prepare another action' }),
    );
    await screen.findByRole('button', { name: 'Prepare action' });
    expect(screen.queryByRole('heading', { name: 'no-change' })).toBeNull();
  });

  it('forgets an uncertain operation when the connection is replaced', async () => {
    const { store } = renderReview();
    const user = await openAction(/^Commit Commit the existing index/);
    await user.type(screen.getByLabelText('Message'), 'Uncertain outcome');
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    await confirmPrepared(user);
    store.loseActionResponse = true;
    await user.click(screen.getByRole('button', { name: 'Confirm commit' }));
    await screen.findByRole('heading', { name: 'Outcome not yet confirmed' });
    store.loseActionResponse = false;
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await screen.findByLabelText('Access token');
    await openAction(/^Commit Commit the existing index/);
    await screen.findByRole('button', { name: 'Prepare action' });
    expect(
      screen.queryByRole('heading', { name: 'Outcome not yet confirmed' }),
    ).toBeNull();
  });
});

describe('workspace theme', () => {
  it('toggles the theme from the disconnected shell and from the connected controls', async () => {
    renderReview();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Switch to dark theme' }),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await user.click(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await connect();
    await screen.findByRole('heading', { name: 'Porcelain', level: 3 });
    await user.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await screen.findByRole('button', { name: 'Switch to light theme' });
  });
});

describe('review surfaces', () => {
  it('inspects a tracked file and a commit from their navigation surfaces', async () => {
    renderReview();
    const user = await connect();
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await user.click(await screen.findByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: /README\.md/ }));
    await screen.findByRole('heading', { name: 'README.md' });
    expect(screen.getByText(/bytes · Read only/)).toBeTruthy();

    await user.click(await screen.findByRole('tab', { name: 'History' }));
    await user.click(
      await screen.findByRole('button', {
        name: /Keep review context scoped to the worktree/,
      }),
    );
    await screen.findByRole('heading', { name: /^Commit / });
    expect(screen.getByText(/Compared with parent/)).toBeTruthy();
  });

  it('reports a change that is no longer present in the current status', async () => {
    const { store } = renderReview();
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
    const data = store.review['629a8628-1cd6-4562-81a2-9c05fba76b4b'];
    if (!data) throw new Error('Missing fixture worktree');
    data.status.changes = data.status.changes.filter(
      (change) =>
        !('newPath' in change && change.newPath?.includes('review-panel')),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh review' }));
    await screen.findByText('Change no longer present');
  });
});

describe('git action cache consequences', () => {
  it('invalidates cached review surfaces for the affected project only', async () => {
    const { store, queryClient } = renderWorkspace();
    const [project, otherProject] = store.inventory.projects;
    const worktree = project?.worktrees[1];
    const sibling = project?.worktrees[2];
    const unrelated = otherProject?.worktrees[0];
    if (!project || !otherProject || !worktree || !sibling || !unrelated)
      throw new Error('Missing fixture review scopes');
    const siblingKey = queryKeys.reviewSurface(
      store.inventory.environmentId,
      { projectId: project.id, worktreeId: sibling.id },
      ['probe'],
    );
    const unrelatedKey = queryKeys.reviewSurface(
      store.inventory.environmentId,
      { projectId: otherProject.id, worktreeId: unrelated.id },
      ['probe'],
    );
    const user = await connect();
    queryClient.setQueryData(siblingKey, {});
    queryClient.setQueryData(unrelatedKey, {});
    await user.click(
      await screen.findByRole('button', { name: /agent\/review/ }),
    );
    await screen.findByRole('button', {
      name: /review-panel.tsx.*staged/,
    });

    await user.click(
      await screen.findByRole('button', { name: 'Git actions' }),
    );
    await user.click(
      await screen.findByRole('menuitem', {
        name: /^Commit Commit the existing index/,
      }),
    );
    await user.type(
      await screen.findByLabelText('Message'),
      'Commit staged work',
    );
    await user.click(screen.getByRole('button', { name: 'Prepare action' }));
    await user.click(
      await screen.findByLabelText(
        'I have reviewed the scope and paused external writers.',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Confirm commit' }));
    await screen.findByRole('heading', { name: 'succeeded' });
    expect(store.actionCount).toBe(1);

    expect(queryClient.getQueryState(siblingKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });
});
