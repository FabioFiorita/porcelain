import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { Toaster } from '@/components/ui/toast';
import { DiscardButton } from './discard';

const { run, restoreRun, recover, state } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({
    state: 'succeeded',
    progress: [],
    result: { restoreStashOid: 'c'.repeat(40), restoreIndex: true },
  }),
  restoreRun: vi.fn().mockResolvedValue({ state: 'succeeded', progress: [] }),
  recover: vi.fn().mockResolvedValue({ state: 'no-change', progress: [] }),
  state: { uncertain: false, fingerprint: 'b'.repeat(64) },
}));

vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useReadCurrentChanges: () => async () => ({
    environmentId: 'environment',
    worktreeId: 'worktree',
    statusToken: 'after',
    inProgress: null,
    mergeHeadOid: null,
    headOid: 'a'.repeat(40),
    branch: { name: 'main', upstream: null, ahead: 0, behind: 0 },
    changes: [],
  }),
  useReviewOverview: () => ({
    changes: {
      statusToken: 'token',
      inProgress: null,
      mergeHeadOid: null,
      headOid: 'a'.repeat(40),
      branch: { name: 'refs/heads/main', upstream: null, ahead: 0, behind: 0 },
      changes: [
        {
          path: 'src/file.ts',
          fingerprint: state.fingerprint,
          comparisons: [],
        },
      ],
    },
  }),
}));
vi.mock('../../query/git-actions', () => ({
  useGitAction: (_scope: unknown, action: string) => ({
    run: action === 'discard' ? run : restoreRun,
    recover: { submit: action === 'discard' ? recover : vi.fn() },
    operation:
      action === 'discard' && state.uncertain ? { requestId: 'request' } : null,
    canStartNew: !(action === 'discard' && state.uncertain),
  }),
}));

function renderDiscard() {
  const client = new QueryClient();
  const key = [
    'review',
    'environment',
    'project',
    'worktree',
    'changes',
  ] as const;
  const result = {
    changes: {
      environmentId: 'environment',
      worktreeId: 'worktree',
      statusToken: 'after',
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
    },
  };
  client.setQueryDefaults(key, { queryFn: async () => result });
  client.setQueryData(key, result);
  return render(
    <QueryClientProvider client={client}>
      <DiscardButton
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        path="src/file.ts"
      />
      <Toaster />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  state.uncertain = false;
  state.fingerprint = 'b'.repeat(64);
  vi.clearAllMocks();
});

it('discards only with the displayed file fingerprint', async () => {
  const screen = await renderDiscard();
  await screen
    .getByRole('button', { name: 'Discard changes to file.ts' })
    .click();
  const dialog = screen.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      { action: 'discard', path: 'src/file.ts' },
      {
        inProgress: null,
        mergeHeadOid: null,
        headOid: 'a'.repeat(40),
        branch: 'main',
        files: [{ path: 'src/file.ts', fingerprint: 'b'.repeat(64) }],
      },
    ),
  );
});

it('restores a discarded last file from the cached post-discard snapshot', async () => {
  const screen = await renderDiscard();
  await screen
    .getByRole('button', { name: 'Discard changes to file.ts' })
    .click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
    .click();
  await screen.getByRole('button', { name: 'Restore' }).click();
  await vi.waitFor(() =>
    expect(restoreRun).toHaveBeenCalledWith(
      {
        action: 'stash-apply',
        stashOid: 'c'.repeat(40),
        restoreIndex: true,
      },
      {
        inProgress: null,
        mergeHeadOid: null,
        headOid: 'a'.repeat(40),
        branch: 'main',
        files: [],
      },
    ),
  );
});

it('recovers an uncertain discard instead of creating a new request', async () => {
  state.uncertain = true;
  const screen = await renderDiscard();
  await screen
    .getByRole('button', { name: 'Discard changes to file.ts' })
    .click();
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Check outcome' })
    .click();
  await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
  expect(run).not.toHaveBeenCalled();
});

it('keeps the confirmed fingerprint when a live refresh changes the file behind the dialog', async () => {
  const screen = await renderDiscard();
  await screen
    .getByRole('button', { name: 'Discard changes to file.ts' })
    .click();
  state.fingerprint = 'd'.repeat(64);
  await screen.rerender(
    <QueryClientProvider client={new QueryClient()}>
      <DiscardButton
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        path="src/file.ts"
      />
      <Toaster />
    </QueryClientProvider>,
  );
  await screen
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard', exact: true })
    .click();
  expect(run).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      files: [{ path: 'src/file.ts', fingerprint: 'b'.repeat(64) }],
    }),
  );
});
