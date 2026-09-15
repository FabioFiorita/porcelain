import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider } from '../workspace/preferences';
import { GitActionInspection } from './git-action-inspection';

const { run, receipt } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ state: 'succeeded' }),
  receipt: { state: 'conflicted' },
}));
vi.mock('../../query/git-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/git-actions')>()),
  useGitAction: () => ({
    run,
    canStartNew: true,
    operation: { receipt },
    recover: { submit: vi.fn() },
  }),
}));
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
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
            environmentId: 'environment',
            worktreeId: 'worktree',
            statusToken: 'a'.repeat(64),
            consistency: 'best-effort',
            headOid: 'a'.repeat(40),
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
      expect(run).toHaveBeenCalledWith({
        remoteName: 'origin',
        sourceRef: 'refs/heads/main',
        strategy,
      }),
    );
  },
);
