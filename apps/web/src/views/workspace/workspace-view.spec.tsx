import type { ComponentProps, ReactNode } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { type Locator, page } from 'vitest/browser';
import { createMockStore } from '../../api/inventory/mock';
import { reportUnauthorized } from '../../api/unauthorized';
import type { Inventory } from '../../domain/inventory';
import { queryKeys } from '../../query/keys';
import { applyLiveNotice } from '../../query/live-updates';
import { renderWorkspace } from '../../test/render';

const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

// The development overlay has its own browser smoke.
vi.mock('../../development/devtools', () => ({ Devtools: () => null }));
// Pierre owns a browser custom element and worker-backed highlighting. Its
// adapter behavior is covered separately; workspace tests exercise navigation.
vi.mock('@pierre/diffs/react', () => ({
  CodeView: ({
    items,
    renderCodeViewHeader,
    renderAnnotation,
    renderHeaderMetadata,
  }: {
    items: Array<{ id: string; annotations?: Array<{ metadata: unknown }> }>;
    renderAnnotation?: (annotation: { metadata: unknown }) => ReactNode;
    renderCodeViewHeader?: () => ReactNode;
    renderHeaderMetadata?: (item: { id: string }) => ReactNode;
  }) => (
    <div data-testid="code-view">
      {renderCodeViewHeader?.()}
      {items.map((item) => (
        <div key={item.id} data-code-item={item.id}>
          {renderHeaderMetadata?.(item)}
          {item.annotations?.map((annotation) =>
            renderAnnotation?.(annotation),
          )}
        </div>
      ))}
    </div>
  ),
  File: ({ file }: { file: { contents: string } }) => (
    <pre>{file.contents}</pre>
  ),
  EditProvider: ({ children }: { children: ReactNode }) => children,
  PatchDiff: ({ patch }: { patch: string }) => <pre>{patch}</pre>,
  Virtualizer: ({ children }: { children: ReactNode }) => children,
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
    setIcons: () => void;
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
        setIcons() {},
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
// Keep review navigation interactive without depending on panel measurements.
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({
    children,
    orientation = 'horizontal',
    ...props
  }: ComponentProps<'div'> & { orientation?: string }) => (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  ),
  ResizablePanel: ({
    children,
    defaultSize = 50,
    minSize,
    maxSize: _maxSize,
    ...props
  }: ComponentProps<'div'> & {
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }) => (
    <div
      {...props}
      style={{
        flexGrow: defaultSize > 100 ? 0 : 1,
        flexShrink: 1,
        flexBasis: defaultSize > 100 ? defaultSize : 0,
        minWidth: minSize,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  ),
  ResizableHandle: (props: ComponentProps<'div'>) => <div {...props} />,
}));

beforeAll(async () => {
  await page.viewport(1280, 800);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 1280px'),
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => mediaListeners.add(listener),
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => mediaListeners.delete(listener),
  }));
});
afterEach(async () => {
  Reflect.deleteProperty(window, 'innerWidth');
  await page.viewport(1280, 800);
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('porcelain.tabs.')) localStorage.removeItem(key);
  }
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type WorkspaceScreen = Awaited<ReturnType<typeof renderWorkspace>>;

function refreshInventory(
  screen: WorkspaceScreen,
  environmentId = screen.store.inventory.environmentId,
) {
  return applyLiveNotice(screen.queryClient, environmentId, {
    type: 'inventory',
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  const event = { matches: width < 768 } as MediaQueryListEvent;
  for (const listener of mediaListeners) listener(event);
}

async function clickThrough(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const node = await locator.element();
  if (!(node instanceof HTMLElement))
    throw new Error('Expected an HTMLElement');
  node.click();
}

async function menuClosed(screen: WorkspaceScreen) {
  await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
}

describe('workspace through the inventory port', () => {
  it('restores an authenticated connection without manual session or reload controls', async () => {
    const first = await renderWorkspace();
    await expect
      .element(first.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    await first.unmount();
    const screen = await renderWorkspace(first.store);
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    for (const name of ['Disconnect', 'Exit', 'Reload', 'Refresh']) {
      await expect
        .element(screen.getByRole('button', { name }))
        .not.toBeInTheDocument();
    }
  });

  it('ends the connection while a page is open when the server refuses it', async () => {
    const screen = await renderWorkspace();
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    expect(screen.queryClient.getQueryCache().getAll()).not.toEqual([]);

    // Revocation lands between requests, not on a reload: the next refused
    // request is what the open page learns from.
    reportUnauthorized();
    await expect
      .element(
        screen.getByRole('heading', { name: 'This browser is not paired' }),
      )
      .toBeVisible();
    // Whatever it had loaded under that device goes with the connection.
    expect(screen.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('tells an unpaired browser how to pair, and caches nothing', async () => {
    const screen = await renderWorkspace(createMockStore('unpaired'));
    await expect
      .element(
        screen.getByRole('heading', { name: 'This browser is not paired' }),
      )
      .toBeVisible();
    // There is nothing to type: a credential arrives as a link, not a field.
    await expect
      .element(screen.getByRole('button', { name: 'Connect' }))
      .not.toBeInTheDocument();
    expect(screen.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('does not restore a saved session after its provider unmounts', async () => {
    const first = await renderWorkspace();
    await expect
      .element(first.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    await first.unmount();
    const store = createMockStore();
    store.delayMs = 50;
    const restoring = await renderWorkspace(store);
    await restoring.unmount();
    await new Promise((resolve) => setTimeout(resolve, store.delayMs + 50));
    expect(restoring.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('refreshes authoritative inventory on a live notice', async () => {
    const screen = await renderWorkspace();
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    // Reading the inventory is the rescan now, so the count is whatever the
    // mount did; what matters is that the live notice causes another one.
    await vi.waitFor(() =>
      expect(screen.store.refreshCount).toBeGreaterThan(0),
    );
    const listedOnMount = screen.store.refreshCount;
    const project = screen.store.inventory.projects[0];
    if (!project) throw new Error('Missing fixture project');
    project.name = 'Renamed project';
    await refreshInventory(screen);
    await expect
      .element(screen.getByRole('heading', { name: 'Renamed project' }))
      .toBeVisible();
    expect(screen.store.refreshCount).toBeGreaterThan(listedOnMount);
  });

  it('retains inventory after a failed live refresh and recovers on the next notice', async () => {
    // Connect first: reading the inventory is the listing, so a store that
    // failed from the start would never show a workspace to retain.
    const store = createMockStore();
    const screen = await renderWorkspace(store);
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    store.refreshFailed = true;
    await refreshInventory(screen);
    await vi.waitFor(() =>
      expect(
        screen.queryClient.getQueryState(
          queryKeys.inventory(store.inventory.environmentId),
        )?.error,
      ).toBeTruthy(),
    );
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    store.refreshFailed = false;
    await refreshInventory(screen);
    await vi.waitFor(() =>
      expect(
        screen.queryClient.getQueryState(
          queryKeys.inventory(store.inventory.environmentId),
        )?.error,
      ).toBeNull(),
    );
  });

  it('rejects inventory from a different environment without replacing current data', async () => {
    const screen = await renderWorkspace();
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    const connectedEnvironmentId = screen.store.inventory.environmentId;
    screen.store.inventory.environmentId =
      '641a8628-1cd6-4562-81a2-9c05fba76b4a';
    screen.store.inventory.projects = [];
    await refreshInventory(screen, connectedEnvironmentId);
    await vi.waitFor(() =>
      expect(
        screen.queryClient.getQueryState(
          queryKeys.inventory(connectedEnvironmentId),
        )?.error,
      ).toBeTruthy(),
    );
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
  });

  it('shows a refused connection without caching private inventory', async () => {
    const screen = await renderWorkspace(createMockStore('rejected'));
    await expect
      .element(
        screen.getByRole('heading', { name: 'This browser is not paired' }),
      )
      .toBeVisible();
    expect(screen.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('opens a server-side project, updates inventory, and selects its first available worktree', async () => {
    const screen = await renderWorkspace();
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Open project' }).click();
    await screen.getByRole('button', { name: 'Enter a path' }).click();
    await screen
      .getByLabelText('Repository path')
      .fill('/srv/work/new-project');
    await screen.getByRole('button', { name: 'Open project' }).click();

    const project = await vi.waitFor(() => {
      const found = screen.store.inventory.projects.find(
        (entry) => entry.worktrees[0]?.path === '/srv/work/new-project',
      );
      if (!found) throw new Error('Missing opened project');
      return found;
    });
    const worktree = project.worktrees.find((entry) => entry.available);
    expect(worktree).toBeDefined();
    expect(
      screen.queryClient.getQueryData<Inventory>(
        queryKeys.inventory(screen.store.inventory.environmentId),
      )?.projects,
    ).toContainEqual(project);
    const opened = screen.getByRole('button', { name: /main.*new-project/ });
    await expect.element(opened).toBeVisible();
    await expect.element(opened).toHaveAttribute('aria-current', 'page');
  });

  it('filters discovered repositories and opens one without typing its path', async () => {
    const screen = await renderWorkspace();
    await screen.getByRole('button', { name: 'Open project' }).click();
    const search = screen.getByRole('textbox', {
      name: 'Search repositories on this machine',
    });
    await search.fill('missing');
    await expect
      .element(screen.getByText('No matching repositories.'))
      .toBeVisible();
    await search.clear();
    await search.fill('new-project');
    await screen.getByRole('button', { name: /new-project.*srv/ }).click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.store.inventory.projects.some((entry) =>
        entry.worktrees.some(
          (worktree) => worktree.path === '/srv/work/new-project',
        ),
      ),
    ).toBe(true);
  });

  it('keeps browsing available after discovery fails and recovers an unreadable folder', async () => {
    const store = createMockStore();
    store.discoveryFailed = true;
    const folder = store.projectFolders['/srv/work/new-project'];
    delete store.projectFolders['/srv/work/new-project'];
    const screen = await renderWorkspace(store);
    await screen.getByRole('button', { name: 'Open project' }).click();
    await expect
      .element(screen.getByText('Could not discover repositories. Try again.'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Open work' }))
      .toBeDisabled();
    await screen.getByRole('button', { name: 'new-project' }).click();
    await expect
      .element(
        screen.getByText(
          'That folder could not be read on the Porcelain server.',
        ),
      )
      .toBeVisible();
    if (!folder) throw new Error('Missing fixture folder');
    store.projectFolders['/srv/work/new-project'] = folder;
    await screen.getByRole('button', { name: 'Try again' }).click();
    await screen.getByRole('button', { name: 'Open new-project' }).click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(
      store.inventory.projects.some((entry) => entry.name === 'new-project'),
    ).toBe(true);
  });

  it('keeps the server path in the form after registration fails', async () => {
    const store = createMockStore();
    store.registerFailed = true;
    const screen = await renderWorkspace(store);
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Open project' }).click();
    const path = '/srv/work/missing-repository';
    await screen.getByRole('button', { name: 'Enter a path' }).click();
    const input = screen.getByLabelText('Repository path');
    await input.fill(path);
    await screen.getByRole('button', { name: 'Open project' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('could not be opened on the Porcelain server');
    await expect.element(input).toHaveValue(path);
    expect(
      store.inventory.projects.some((project) =>
        project.worktrees.some((worktree) => worktree.path === path),
      ),
    ).toBe(false);
  });
});

describe('project removal', () => {
  it('confirms the scope, preserves a failed removal, and switches away from the removed project', async () => {
    const store = createMockStore();
    const project = store.inventory.projects[0];
    if (!project) throw new Error('Missing fixture project');
    const screen = await renderWorkspace(store);
    const trigger = screen.getByRole('button', { name: project.name });
    await expect.element(trigger).toBeVisible();
    await trigger.click({ button: 'right' });
    await screen
      .getByRole('menuitem', { name: 'Remove from Porcelain' })
      .click();
    const dialog = screen.getByRole('alertdialog');
    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog)
      .toMatchTextContent('Repository files and Git history stay on disk.');
    await clickThrough(dialog.getByRole('button', { name: 'Cancel' }));
    await expect
      .element(screen.getByRole('alertdialog'))
      .not.toBeInTheDocument();
    expect(store.inventory.projects).toContain(project);
    await trigger.click({ button: 'right' });
    await screen
      .getByRole('menuitem', { name: 'Remove from Porcelain' })
      .click();
    await expect.element(dialog).toBeVisible();
    store.removeFailed = true;
    await clickThrough(
      dialog.getByRole('button', { name: 'Remove from Porcelain' }),
    );
    await expect
      .element(dialog.getByRole('alert'))
      .toMatchTextContent('active or unresolved Git operation');
    expect(store.inventory.projects).toContain(project);
    store.removeFailed = false;
    await clickThrough(
      dialog.getByRole('button', { name: 'Remove from Porcelain' }),
    );
    await expect
      .element(screen.getByRole('alertdialog'))
      .not.toBeInTheDocument();
    expect(store.inventory.projects).not.toContain(project);
    await expect
      .element(screen.getByRole('button', { name: project.name }))
      .not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(document.querySelector('[aria-current="page"]')).not.toBeNull();
    });
  });

  it('shows the empty workspace when the final project is removed', async () => {
    const store = createMockStore();
    store.inventory.projects = store.inventory.projects.slice(0, 1);
    const screen = await renderWorkspace(store);
    const project = store.inventory.projects[0];
    if (!project) throw new Error('Missing fixture project');
    await screen
      .getByRole('button', { name: project.name })
      .click({ button: 'right' });
    await screen
      .getByRole('menuitem', { name: 'Remove from Porcelain' })
      .click();
    await clickThrough(
      screen
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Remove from Porcelain' }),
    );
    await expect
      .element(screen.getByText('No projects registered'))
      .toBeVisible();
    await expect.element(screen.getByText('Select a worktree')).toBeVisible();
  });
});

describe('worktree review navigation', () => {
  it('keeps the review workspace mounted while desktop navigation is toggled', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();

    const reviewContent = screen.getByRole('region', {
      name: 'Review content',
    });
    await expect.element(reviewContent).toBeVisible();
    const reviewNode = await reviewContent.element();
    const navigationToggle = screen.getByRole('button', {
      name: /^Toggle Sidebar$/,
    });

    await navigationToggle.click();
    await expect
      .element(
        screen.getByRole('navigation', { name: 'Projects and worktrees' }),
      )
      .not.toBeInTheDocument();
    expect(await reviewContent.element()).toBe(reviewNode);
    await expect
      .element(navigationToggle)
      .toHaveAttribute('aria-expanded', 'false');

    await navigationToggle.click();
    await expect
      .element(
        screen.getByRole('navigation', { name: 'Projects and worktrees' }),
      )
      .toBeVisible();
    expect(await reviewContent.element()).toBe(reviewNode);
  });

  it('keeps the review workspace and an unsent draft across the mobile breakpoint', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen
      .getByRole('button', { name: /^review-panel\.tsx.*staged/ })
      .click();
    await screen
      .getByRole('button', {
        name: /^Comment on src\/components\/review-panel.tsx/,
      })
      .click();
    await screen.getByLabelText('Comment').fill('Keep this draft');
    const reviewContent = screen.getByRole('region', {
      name: 'Review content',
    });
    const reviewNode = await reviewContent.element();

    setViewportWidth(640);

    expect(await reviewContent.element()).toBe(reviewNode);
    await expect
      .element(screen.getByLabelText('Comment'))
      .toHaveValue('Keep this draft');

    setViewportWidth(1024);
    expect(await reviewContent.element()).toBe(reviewNode);
    await expect
      .element(screen.getByLabelText('Comment'))
      .toHaveValue('Keep this draft');
  });

  it('opens the initial handoff when tab storage is unavailable', async () => {
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(function (this: Storage, key: string) {
        if (key.startsWith('porcelain.tabs.'))
          throw new DOMException('Storage denied', 'SecurityError');
        return originalGetItem.call(this, key);
      });
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Handoff' }))
      .toBeVisible();
    getItem.mockRestore();
  });

  it('scopes selection to each worktree', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen
      .getByRole('button', { name: /^review-panel.tsx.*staged/ })
      .click();
    await expect
      .element(
        screen.getByRole('button', {
          name: /^Comment on src\/components\/review-panel.tsx/,
        }),
      )
      .toBeVisible();
    await screen
      .getByRole('button', {
        name: /main.*sample-project.*Main worktree/,
      })
      .click();
    await expect
      .element(screen.getByText('No changes to review'))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole('heading', {
          name: 'src/components/review-panel.tsx',
        }),
      )
      .not.toBeInTheDocument();
  });
  it('recovers failed review reads without adding unsupported navigation surfaces', async () => {
    const store = createMockStore();
    store.changesFailed = true;
    const screen = await renderReview(store);
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    const sidebar = screen.getByTestId('review-sidebar');
    expect(
      sidebar
        .getByRole('tab', {
          name: /^(Changes|Files|History)$/,
        })
        .all(),
    ).toHaveLength(3);
    await sidebar.getByRole('tab', { name: 'Files' }).click();
    await expect
      .element(screen.getByRole('button', { name: /README\.md/ }))
      .toBeVisible();
    await sidebar.getByRole('tab', { name: 'Changes' }).click();
    const failedReviewRetries = screen.getByRole('button', {
      name: 'Try again',
    });
    await expect.element(failedReviewRetries.first()).toBeVisible();
    expect(failedReviewRetries.all().length).toBeGreaterThan(0);
    store.changesFailed = false;
    await failedReviewRetries.first().click();
    const remainingReviewRetries = screen.getByRole('button', {
      name: 'Try again',
    });
    if (remainingReviewRetries.query()) {
      await remainingReviewRetries.first().click();
    }
    const recovered = screen.getByRole('button', {
      name: /A clearer review experience/,
    });
    await expect.element(recovered.first()).toBeVisible();
    expect(recovered.all().length).toBeGreaterThan(0);
    await expect
      .element(screen.getByRole('tab', { name: 'Artifacts' }))
      .not.toBeInTheDocument();
    expect(
      sidebar
        .getByRole('tab', {
          name: /^(Review|Files|History)$/,
        })
        .all(),
    ).toHaveLength(3);
  });
  it('keeps file documents and Git controls available when artifacts fail', async () => {
    const store = createMockStore();
    store.artifactsFailed = true;
    const screen = await renderReview(store);
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    const sidebar = screen.getByTestId('review-sidebar');
    await sidebar.getByRole('tab', { name: 'Files' }).click();
    await sidebar.getByRole('button', { name: /README\.md/ }).click();

    await expect
      .element(screen.getByRole('heading', { name: 'README.md' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Git actions' }))
      .toBeVisible();
  });
  it('keeps stored artifacts reachable for an unavailable worktree', async () => {
    const screen = await renderReview();
    await screen
      .getByRole('button', { name: /archive\/initial-prototype/ })
      .click();
    await expect
      .element(screen.getByText('Stored agent reports'))
      .toBeVisible();
    await screen
      .getByTestId('review-sidebar')
      .getByRole('button', {
        name: /Keyboard accessibility audit/,
      })
      .click();
    const headings = screen.getByRole('heading', {
      name: 'Keyboard accessibility audit',
    });
    await expect.element(headings.first()).toBeVisible();
    expect(headings.all()).toHaveLength(2);
  });
  it('renders the report in an opaque-origin sandboxed frame', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen.getByRole('button', { name: /The whole handoff/ }).click();
    const reportButtons = screen.getByRole('button', {
      name: /Launch review report/,
    });
    await expect.element(reportButtons.first()).toBeVisible();
    await reportButtons.first().click();

    await expect
      .element(screen.getByRole('heading', { name: 'Launch review report' }))
      .toBeVisible();
    const frame = screen.getByTitle('Launch review report');
    await expect.element(frame).toBeVisible();
    expect((await frame.element()).tagName).toBe('IFRAME');
    await expect.element(frame).toHaveAttribute('sandbox', 'allow-scripts');
    await expect
      .element(frame)
      .toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect
      .element(frame)
      .toHaveAttribute(
        'srcdoc',
        expect.stringContaining('Fieldnotes launch review'),
      );
  });
  it.each([false, true])(
    'commits selected files and recovers without repeating the action (lost response: %s)',
    async (loseResponse) => {
      const screen = await renderReview();
      await screen.getByRole('button', { name: /agent\/review/ }).click();
      await screen.getByRole('button', { name: 'Git actions' }).click();
      await screen
        .getByRole('menuitem', {
          name: /Commit selected files/,
        })
        .click();
      await menuClosed(screen);
      await screen.getByLabelText('Message').fill('Review sidebar foundation');
      expect(screen.store.actionCount).toBe(0);
      const confirm = screen.getByRole('button', {
        name: 'Commit selected files',
      });
      screen.store.loseActionResponse = loseResponse;
      await clickThrough(confirm);
      if (loseResponse) {
        await expect
          .element(screen.getByText('Outcome not yet confirmed'))
          .toBeVisible();
        await clickThrough(screen.getByRole('button', { name: 'Close' }));
        await expect
          .element(
            screen.getByRole('button', { name: 'Prepare another action' }),
          )
          .not.toBeInTheDocument();
        await screen.getByRole('tab', { name: 'Files' }).click();
        await screen.getByRole('button', { name: 'Git actions' }).click();
        await screen
          .getByRole('menuitem', { name: /Commit selected files/ })
          .click();
        await menuClosed(screen);
        await expect
          .element(screen.getByText('Outcome not yet confirmed'))
          .toBeVisible();
        await clickThrough(
          screen.getByRole('button', { name: 'Check outcome' }),
        );
      }
      await expect
        .element(screen.getByRole('status').filter({ hasText: 'succeeded' }))
        .toBeVisible();
      expect(screen.store.actionCount).toBe(1);
      const data = screen.store.review['629a86281cd6456281a29c05fba76b4b'];
      expect(
        data?.git.comparisons.some((change) => change.scope === 'staged'),
      ).toBe(false);
      expect(
        data?.git.comparisons.some((change) => change.scope === 'unstaged'),
      ).toBe(false);
      await clickThrough(screen.getByRole('button', { name: 'Check outcome' }));
      expect(screen.store.actionCount).toBe(1);
      const close = screen.getByRole('button', { name: 'Close' });
      if (close.query()) await clickThrough(close);
      await screen.getByRole('tab', { name: 'History' }).click();
      await expect
        .element(
          screen.getByRole('button', { name: /Review sidebar foundation/ }),
        )
        .toBeVisible();
    },
  );
});

async function renderReview(store = createMockStore()) {
  store.inventory.projects = store.inventory.projects.slice(0, 1);
  return renderWorkspace(store);
}

describe('file discussion', () => {
  it('preserves failed drafts, saves to the selected file and hides the discussion on other files', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen
      .getByRole('button', { name: /^review-panel.tsx.*staged/ })
      .click();
    await screen
      .getByRole('button', {
        name: /^Comment on src\/components\/review-panel.tsx/,
      })
      .click();
    await screen
      .getByLabelText('Comment')
      .fill('Please explain this component.');
    screen.store.commentsFailed = true;
    await screen.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Comments are unavailable');
    await expect
      .element(screen.getByLabelText('Comment'))
      .toHaveValue('Please explain this component.');
    expect(Object.values(screen.store.comments).flat()).toHaveLength(0);
    screen.store.commentsFailed = false;
    await screen.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect
      .element(screen.getByText('Please explain this component.'))
      .toBeVisible();
    expect(
      Object.values(screen.store.comments).flat()[0]?.anchor,
    ).toMatchObject({
      kind: 'file',
      filePath: 'src/components/review-panel.tsx',
    });
    await screen
      .getByRole('button', { name: /empty-state.tsx.*staged/ })
      .click();
    await screen
      .getByRole('button', {
        name: /^Comment on src\/components\/empty-state.tsx/,
      })
      .click();
    await expect.element(screen.getByLabelText('Comment')).toHaveValue('');
    await expect
      .element(screen.getByText('Please explain this component.'))
      .not.toBeInTheDocument();
  });
});

describe('git actions', () => {
  async function openAction(screen: WorkspaceScreen, name: RegExp) {
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen.getByRole('button', { name: 'Git actions' }).click();
    await screen.getByRole('menuitem', { name }).click();
    await menuClosed(screen);
  }

  it('uses the remote destination and executes a push once', async () => {
    const screen = await renderReview();
    await openAction(screen, /Send committed changes/);
    await expect.element(screen.getByLabelText('Remote')).toHaveValue('origin');
    await clickThrough(
      screen.getByLabelText('Create the remote branch if needed'),
    );
    await clickThrough(screen.getByRole('button', { name: 'Push' }));
    await expect
      .element(screen.getByRole('status').filter({ hasText: 'succeeded' }))
      .toBeVisible();
    expect(screen.store.actionCount).toBe(1);
  });

  it('reports a preparation the environment refuses without starting an operation', async () => {
    const screen = await renderReview();
    await openAction(screen, /Restore a stash and keep it/);
    await screen.getByRole('textbox', { name: 'Stash' }).fill('a'.repeat(40));
    await clickThrough(screen.getByLabelText('Restore staged changes'));
    await clickThrough(screen.getByRole('button', { name: 'Apply stash' }));
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('not simulated in this mock');
    await expect
      .element(screen.getByRole('button', { name: /^Confirm/ }))
      .not.toBeInTheDocument();
    expect(screen.store.actionCount).toBe(0);
  });

  it('keeps file selection editable before submitting', async () => {
    const screen = await renderReview();
    await openAction(screen, /Commit selected files/);
    await screen.getByLabelText('Message').fill('Selected files');
    for (const file of screen.getByRole('checkbox').all())
      await clickThrough(file);
    await expect
      .element(screen.getByRole('button', { name: 'Commit selected files' }))
      .toBeDisabled();
    expect(screen.store.actionCount).toBe(0);
  });

  it('does not submit a commit when there are no changed files', async () => {
    const screen = await renderReview();
    await screen
      .getByRole('button', {
        name: /main.*sample-project.*Main worktree/,
      })
      .click();
    await screen.getByRole('button', { name: 'Git actions' }).click();
    await screen
      .getByRole('menuitem', {
        name: /Commit selected files/,
      })
      .click();
    await screen.getByLabelText('Message').fill('Nothing changed');
    await expect
      .element(screen.getByRole('button', { name: 'Commit selected files' }))
      .toBeDisabled();
    expect(screen.store.actionCount).toBe(0);
  });
});

describe('workspace theme', () => {
  it('keeps theme selection inside Settings', async () => {
    const screen = await renderReview();
    await expect
      .element(screen.getByRole('button', { name: /Switch to .* theme/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('heading', { name: 'Porcelain', level: 3 }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: /Switch to .* theme/ }))
      .not.toBeInTheDocument();
    await screen.getByRole('button', { name: /^Settings/ }).click();
    await screen.getByRole('tab', { name: 'Dark' }).click();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await screen.getByRole('tab', { name: 'Light' }).click();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('review surfaces', () => {
  it('inspects a tracked file and a commit from their navigation surfaces', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await screen.getByRole('tab', { name: 'Files' }).click();
    await screen.getByRole('button', { name: /README\.md/ }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'README.md' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Copy path' }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/bytes · Read only/))
      .not.toBeInTheDocument();

    await screen.getByRole('tab', { name: 'History' }).click();
    await screen
      .getByRole('button', {
        name: /Keep review context scoped to the worktree/,
      })
      .click();
    await expect
      .element(screen.getByRole('heading', { name: /^[0-9a-f]{7}$/ }))
      .toBeVisible();
    await expect.element(screen.getByText(/against/)).toBeVisible();
  });

  /**
   * The change list is not re-read when the window is focused, so a document
   * can be opened from a listing that has since moved on. The server refuses
   * hunks whose fingerprint no longer matches, and that refusal is what sends
   * the client back for a current list — so the reader is told the change is
   * gone rather than shown an empty document.
   */
  it('reports a change that is no longer present in the current status', async () => {
    const screen = await renderReview();
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await expect
      .element(
        screen.getByRole('button', { name: /^review-panel.tsx.*staged/ }),
      )
      .toBeVisible();
    const data = screen.store.review['629a86281cd6456281a29c05fba76b4b'];
    if (!data) throw new Error('Missing fixture worktree');
    data.git.comparisons = data.git.comparisons.filter(
      (change) =>
        !('newPath' in change && change.newPath?.includes('review-panel')),
    );
    await screen
      .getByRole('button', { name: /^review-panel.tsx.*staged/ })
      .click();
    await expect
      .element(screen.getByText('Change no longer present'))
      .toBeVisible();
  });
});

describe('git action cache consequences', () => {
  it('invalidates cached review surfaces for the affected project only', async () => {
    const screen = await renderWorkspace();
    const [project, otherProject] = screen.store.inventory.projects;
    const worktree = project?.worktrees[1];
    const sibling = project?.worktrees[2];
    const unrelated = otherProject?.worktrees[0];
    if (!project || !otherProject || !worktree || !sibling || !unrelated)
      throw new Error('Missing fixture review scopes');
    const siblingKey = queryKeys.reviewSurface(
      screen.store.inventory.environmentId,
      { projectId: project.id, worktreeId: sibling.id },
      ['probe'],
    );
    const unrelatedKey = queryKeys.reviewSurface(
      screen.store.inventory.environmentId,
      { projectId: otherProject.id, worktreeId: unrelated.id },
      ['probe'],
    );
    screen.queryClient.setQueryData(siblingKey, {});
    screen.queryClient.setQueryData(unrelatedKey, {});
    await screen.getByRole('button', { name: /agent\/review/ }).click();
    await expect
      .element(
        screen.getByRole('button', {
          name: /^review-panel.tsx.*staged/,
        }),
      )
      .toBeVisible();

    await screen.getByRole('button', { name: 'Git actions' }).click();
    await screen
      .getByRole('menuitem', {
        name: /Commit selected files/,
      })
      .click();
    await menuClosed(screen);
    await screen.getByLabelText('Message').fill('Commit staged work');
    await clickThrough(
      screen.getByRole('button', { name: 'Commit selected files' }),
    );
    await expect
      .element(screen.getByRole('status').filter({ hasText: 'succeeded' }))
      .toBeVisible();
    expect(screen.store.actionCount).toBe(1);

    expect(screen.queryClient.getQueryState(siblingKey)?.isInvalidated).toBe(
      true,
    );
    expect(screen.queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(
      false,
    );
  });
});
