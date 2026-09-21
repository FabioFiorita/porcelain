import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider } from '../workspace/preferences';
import { CommitForm } from './commit-form';

const { run, draft, state } = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({
    state: 'succeeded',
    progress: [],
    result: { inProgress: null, mergeHeadOid: null, headOid: 'c'.repeat(40) },
  }),
  draft: vi.fn(),
  state: { draftPending: false },
}));

vi.mock('../../query/git-actions', () => ({
  useGitAction: () => ({
    run,
    operation: null,
    canStartNew: false,
    recover: { submit: vi.fn() },
  }),
  useCommitModels: () => ({ data: [{ id: 'codex:luna', label: 'Luna' }] }),
  useCommitDraft: () => ({ submit: draft, isPending: state.draftPending }),
}));

const status = {
  statusToken: 'token',
  inProgress: null,
  mergeHeadOid: null,
  headOid: 'a'.repeat(40),
  branch: { name: 'refs/heads/main', upstream: null, ahead: 0, behind: 0 },
  changes: [
    {
      scope: 'unstaged' as const,
      kind: 'modified' as const,
      oldPath: 'src/file.ts',
      newPath: 'src/file.ts',
      oldMode: '100644',
      newMode: '100644',
      oldOid: null,
      newOid: null,
      supported: true,
    },
  ],
  files: [{ path: 'src/file.ts', fingerprint: 'b'.repeat(64) }],
};

afterEach(() => {
  state.draftPending = false;
  vi.clearAllMocks();
});

it('amends with the displayed HEAD and selected fingerprint', async () => {
  const screen = await render(
    <PreferencesProvider>
      <CommitForm
        action="amend"
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        status={status}
        onBusy={() => {}}
      />
    </PreferencesProvider>,
  );
  await screen.getByLabelText('Message').fill('Refine the last commit');
  await screen.getByRole('button', { name: 'Amend last commit' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      {
        action: 'amend',
        message: 'Refine the last commit',
        paths: ['src/file.ts'],
      },
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

it('aborts draft generation on close without marking a Git write busy', async () => {
  let signal: AbortSignal | undefined;
  draft.mockImplementationOnce(
    (input: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal = input.signal;
        input.signal?.addEventListener('abort', () =>
          reject(input.signal?.reason),
        );
      }),
  );
  const onBusy = vi.fn();
  const screen = await render(
    <PreferencesProvider>
      <CommitForm
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        status={status}
        onBusy={onBusy}
      />
    </PreferencesProvider>,
  );
  await screen.getByRole('button', { name: 'Generate with AI' }).click();
  await vi.waitFor(() => expect(signal).toBeDefined());
  expect(onBusy).not.toHaveBeenCalled();
  await screen.unmount();
  expect(signal?.aborted).toBe(true);
});

it('amends only the message with an explicit empty file expectation', async () => {
  const screen = await render(
    <PreferencesProvider>
      <CommitForm
        action="amend"
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        status={{ ...status, changes: [], files: [] }}
        initialMessage={'Previous subject\n\nPrevious body'}
        replacedSubject="Previous subject"
        onBusy={() => {}}
      />
    </PreferencesProvider>,
  );
  await expect
    .element(screen.getByLabelText('Message'))
    .toHaveValue('Previous subject\n\nPrevious body');
  await screen.getByLabelText('Message').fill('Corrected message');
  await screen.getByRole('button', { name: 'Amend last commit' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      { action: 'amend', message: 'Corrected message', paths: [] },
      {
        headOid: 'a'.repeat(40),
        branch: 'main',
        inProgress: null,
        mergeHeadOid: null,
        files: [],
      },
    ),
  );
});

it('shows whole-index merge scope and protects all displayed files in its expectation', async () => {
  const screen = await render(
    <PreferencesProvider>
      <CommitForm
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        status={{
          ...status,
          inProgress: 'merge',
          mergeHeadOid: 'e'.repeat(40),
          files: [
            ...status.files,
            { path: 'other.ts', fingerprint: 'd'.repeat(64) },
          ],
        }}
        onBusy={() => {}}
      />
    </PreferencesProvider>,
  );
  await expect
    .element(screen.getByText(/commits every staged resolution/))
    .toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Use groups' }))
    .not.toBeInTheDocument();
  await screen.getByLabelText('Message').fill('Finish merge');
  await screen.getByRole('button', { name: 'Commit selected files' }).click();
  await vi.waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      { action: 'commit', message: 'Finish merge', paths: ['src/file.ts'] },
      {
        headOid: 'a'.repeat(40),
        branch: 'main',
        inProgress: 'merge',
        mergeHeadOid: 'e'.repeat(40),
        files: [
          ...status.files,
          { path: 'other.ts', fingerprint: 'd'.repeat(64) },
        ],
      },
    ),
  );
});
