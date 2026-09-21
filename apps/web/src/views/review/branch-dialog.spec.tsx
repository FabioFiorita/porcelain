import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { BranchDialog } from './branch-dialog';

const { run, recover, state } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ state: 'succeeded' }),
  recover: vi.fn().mockResolvedValue({ state: 'succeeded' }),
  state: { uncertain: false },
}));

vi.mock('../../query/git-actions', () => ({
  useBranches: () => ({
    data: { current: 'main', branches: [] },
    isPending: false,
  }),
  useGitAction: () => ({
    run,
    recover: { submit: recover },
    operation: state.uncertain ? { requestId: 'request' } : null,
    canStartNew: !state.uncertain,
  }),
}));

afterEach(() => {
  state.uncertain = false;
  vi.clearAllMocks();
});

it('creates a branch against the displayed HEAD and short branch', async () => {
  const screen = await render(
    <BranchDialog
      open
      mode="create"
      scope={{ projectId: 'project', worktreeId: 'worktree' }}
      status={{
        statusToken: 'token',
        inProgress: null,
        mergeHeadOid: null,
        headOid: 'a'.repeat(40),
        branch: {
          name: 'refs/heads/main',
          upstream: null,
          ahead: 0,
          behind: 0,
        },
        changes: [],
        files: [],
      }}
      onOpenChange={() => {}}
    />,
  );
  await screen.getByLabelText('Branch name').fill('fix/recovery');
  await screen.getByRole('button', { name: 'Create branch' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      { action: 'create-branch', branch: 'fix/recovery', switchTo: true },
      {
        inProgress: null,
        mergeHeadOid: null,
        headOid: 'a'.repeat(40),
        branch: 'main',
      },
    ),
  );
});

it('recovers the retained branch request before allowing another write', async () => {
  state.uncertain = true;
  const screen = await render(
    <BranchDialog
      open
      mode="create"
      scope={{ projectId: 'project', worktreeId: 'worktree' }}
      status={{ statusToken: 'token', changes: [] }}
      onOpenChange={() => {}}
    />,
  );
  await screen.getByRole('button', { name: 'Check outcome' }).click();
  await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
  expect(run).not.toHaveBeenCalled();
});
