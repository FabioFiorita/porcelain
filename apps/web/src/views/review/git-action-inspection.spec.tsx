// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../workspace/preferences';
import { GitActionInspection } from './git-action-inspection';

const { run, receipt } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ state: 'succeeded' }),
  receipt: { state: 'conflicted' },
}));
vi.mock('../../query/git-actions', () => ({
  useGitAction: () => ({
    run,
    canStartNew: true,
    operation: { receipt },
    recover: { submit: vi.fn() },
  }),
}));
afterEach(() => {
  cleanup();
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
    render(
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
    expect(screen.getByRole('alert').textContent).toContain(
      'git merge --abort',
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'git rebase --abort',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith({
        remoteName: 'origin',
        sourceRef: 'refs/heads/main',
        strategy,
      }),
    );
  },
);
