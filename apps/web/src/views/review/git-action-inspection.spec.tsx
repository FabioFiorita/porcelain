import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider } from '../workspace/preferences';
import { GitActionInspection } from './git-action-inspection';

const { run, receipt } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ state: 'succeeded' }),
  receipt: { state: 'conflicted', reason: undefined as string | undefined },
}));
// Branch details are their own read, made when this panel opens.
vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useGitStatus: () => ({ status: undefined, pending: false }),
}));
vi.mock('../../query/git-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/git-actions')>()),
  useGitAction: () => ({
    run,
    canStartNew: true,
    operation: { receipt },
    recover: { submit: vi.fn() },
    startNew: () => {
      receipt.reason = undefined;
    },
  }),
}));
afterEach(() => {
  receipt.state = 'conflicted';
  receipt.reason = undefined;
  window.localStorage.clear();
  vi.clearAllMocks();
});

it('warns that a stash leaves the handoff empty', async () => {
  const screen = await render(
    <PreferencesProvider>
      <GitActionInspection
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        entry="stash-create"
        onBusy={() => {}}
        status={{
          statusToken: 'a'.repeat(64),
          changes: [],
        }}
      />
    </PreferencesProvider>,
  );
  await expect.element(screen.getByText(/handoff stays empty/u)).toBeVisible();
  await screen.getByRole('button', { name: 'Stash changes' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      {
        action: 'stash-create',
        message: 'Porcelain review',
        includeUntracked: true,
      },
      {
        branch: null,
        inProgress: null,
        mergeHeadOid: null,
        headOid: null,
        files: [],
      },
    ),
  );
});

it.each(['merge', 'rebase'])(
  'submits the saved %s strategy and explains conflict recovery',
  async (strategy) => {
    window.localStorage.setItem(
      'porcelain.prototype.preferences',
      JSON.stringify({ pullStrategy: strategy }),
    );
    const screen = await render(
      <PreferencesProvider>
        <GitActionInspection
          scope={{ projectId: 'project', worktreeId: 'worktree' }}
          entry="pull"
          onBusy={() => {}}
          status={{
            statusToken: 'a'.repeat(64),
            changes: [],
          }}
        />
      </PreferencesProvider>,
    );
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('git merge --abort');
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('git rebase --abort');
    await screen.getByRole('button', { name: 'Pull' }).click();
    await vi.waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        {
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
          strategy,
        },
        {
          branch: null,
          inProgress: null,
          mergeHeadOid: null,
          headOid: null,
          upstreamOid: null,
        },
      ),
    );
  },
);

it('reads a new expectation after Look again instead of repeating the stale request', async () => {
  receipt.state = 'rejected';
  receipt.reason = 'CHANGED_SINCE_LOOKED';
  function Panel() {
    const [head, setHead] = useState('a'.repeat(40));
    return (
      <PreferencesProvider>
        <GitActionInspection
          scope={{ projectId: 'project', worktreeId: 'worktree' }}
          entry="fetch"
          onBusy={() => {}}
          status={{
            statusToken: 'token',
            inProgress: null,
            mergeHeadOid: null,
            headOid: head,
            changes: [],
          }}
          onLookAgain={async () => setHead('b'.repeat(40))}
        />
      </PreferencesProvider>
    );
  }
  const screen = await render(<Panel />);
  await expect
    .element(screen.getByRole('status'))
    .toMatchTextContent('changed since looked');
  await screen.getByRole('button', { name: 'Look again' }).click();
  await expect
    .element(screen.getByRole('button', { name: 'Look again' }))
    .not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Fetch', exact: true }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      { action: 'fetch', remoteName: 'origin', sourceRef: 'refs/heads/main' },
      {
        inProgress: null,
        mergeHeadOid: null,
        headOid: 'b'.repeat(40),
        branch: null,
        upstreamOid: null,
      },
    ),
  );
});
