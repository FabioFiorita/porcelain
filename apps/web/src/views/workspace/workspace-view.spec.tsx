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
import { queryKeys } from '../../query/keys';
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
afterEach(() => {
  cleanup();
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
  it.each([false, true])(
    'commits only staged changes and recovers without repeating the action (lost response: %s)',
    async (loseResponse) => {
      const { store } = renderReview();
      const user = await connect();
      await user.click(
        await screen.findByRole('button', { name: /agent\/review/ }),
      );
      await user.click(screen.getByRole('tab', { name: 'Git' }));
      await user.click(
        screen.getByRole('button', {
          name: /^Commit Commit the existing index/,
        }),
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
      store.loseActionResponse = loseResponse;
      await user.click(confirm);
      if (loseResponse) {
        await screen.findByRole('heading', {
          name: 'Outcome not yet confirmed',
        });
        expect(
          screen.queryByRole('button', { name: 'Prepare another action' }),
        ).toBeNull();
        await user.click(screen.getByRole('tab', { name: 'Files' }));
        await user.click(screen.getByRole('tab', { name: 'Git' }));
        await user.click(
          screen.getByRole('button', { name: /^Commit Commit/ }),
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
      await user.click(screen.getByRole('tab', { name: 'History' }));
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
      screen.getByRole('button', { name: /empty-state.tsx.*added/ }),
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
    await user.click(screen.getByRole('tab', { name: 'Git' }));
    await user.click(screen.getByRole('button', { name }));
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
    await user.click(screen.getByRole('tab', { name: 'Git' }));
    await user.click(
      screen.getByRole('button', { name: /^Commit Commit the existing index/ }),
    );
    await user.type(screen.getByLabelText('Message'), 'Nothing staged');
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
    await user.click(screen.getByRole('tab', { name: 'Files' }));
    await user.click(await screen.findByRole('button', { name: /README\.md/ }));
    await screen.findByRole('heading', { name: 'README.md' });
    expect(screen.getByText(/bytes · Read only/)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'History' }));
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

    await user.click(screen.getByRole('tab', { name: 'Git' }));
    await user.click(
      screen.getByRole('button', { name: /^Commit Commit the existing index/ }),
    );
    await user.type(screen.getByLabelText('Message'), 'Commit staged work');
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
