import { expect, it } from 'vitest';
import {
  archiveSettings,
  archiveOptions,
  archiveDescription,
  archiveFailureMessage,
  worktreeCleanupOptions,
  worktreeBranchChoices,
  worktreeCleanupDescription,
  worktreeCleanupFailureMessage,
  worktreeCleanupFields,
} from './worktree-actions.ts';
const settings = {
  pullStrategy: 'merge' as const,
  collapseSpecs: false,
  archiveDeleteWorktree: true,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: true,
};
it('uses the same explicit resource choices on web and native without introducing saved preferences', () => {
  expect(worktreeCleanupFields).toEqual([
    { key: 'deleteWorktree', label: 'Delete local worktree' },
    { key: 'deleteLocalBranch', label: 'Delete local branch' },
    { key: 'deleteRemoteBranch', label: 'Delete remote branch' },
  ]);
});
it('starts each one-off deletion from saved options and disables branch deletion for detached worktrees without mutating settings', () => {
  expect(worktreeCleanupOptions(settings, false)).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: true,
    deleteRemoteBranch: true,
  });
  expect(worktreeCleanupOptions(settings, true)).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: false,
    deleteRemoteBranch: false,
  });
  expect(settings.archiveDeleteRemoteBranch).toBe(true);
});
it('lists only local branches and distinguishes the current checkout from another occupied branch', () => {
  expect(
    worktreeBranchChoices(
      [
        { ref: 'refs/heads/main', name: 'main', remote: false },
        { ref: 'refs/heads/topic', name: 'topic', remote: false },
        { ref: 'refs/heads/free', name: 'free', remote: false },
        { ref: 'refs/remotes/origin/main', name: 'origin/main', remote: true },
      ],
      [
        { id: 'main', branch: 'main' },
        { id: 'other', branch: 'topic' },
      ],
      'main',
    ),
  ).toEqual([
    {
      ref: 'refs/heads/main',
      name: 'main',
      remote: false,
      current: true,
      inUse: false,
    },
    {
      ref: 'refs/heads/topic',
      name: 'topic',
      remote: false,
      current: false,
      inUse: true,
    },
    {
      ref: 'refs/heads/free',
      name: 'free',
      remote: false,
      current: false,
      inUse: false,
    },
  ]);
});
it('describes deletion resources and ignored-file loss without claiming a review is archived', () => {
  const text = worktreeCleanupDescription({
    worktreePath: '/project/topic',
    mainCheckout: false,
    dirty: true,
    unpushed: false,
    fingerprint: 'snapshot',
  });
  expect(text).toContain('including ignored files');
  expect(text).toContain('uncommitted changes');
  expect(text).not.toContain('review');
  expect(worktreeCleanupFailureMessage(new Error('Locked'))).toBe('Locked');
  expect(worktreeCleanupFailureMessage(undefined)).toBe(
    'Deletion could not be completed. Prepare the deletion again.',
  );
});

it('turns the computer’s archive settings into the deletions an archive plan asks for', () => {
  expect(
    archiveOptions({
      archiveDeleteWorktree: true,
      archiveDeleteLocalBranch: false,
      archiveDeleteRemoteBranch: true,
    }),
  ).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: false,
    deleteRemoteBranch: true,
  });
  expect(archiveSettings.map((setting) => setting.label)).toEqual([
    'Delete local worktree',
    'Delete local branch',
    'Delete remote branch',
  ]);
});

it('names the exact deletion targets and warns separately about files and commits', () => {
  expect(
    archiveDescription({
      worktreePath: '/code/feature',
      localBranch: 'feature',
      remoteBranch: 'origin/feature',
      mainCheckout: false,
      dirty: true,
      unpushed: true,
      fingerprint: 'snapshot',
    }),
  ).toBe(
    'The review and its saved revisions will remain available with Show older reviews.\n\nDelete worktree: /code/feature\n\nThe entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.\n\nDelete local branch: feature\n\nDelete remote branch: origin/feature\n\nWarning: this worktree has uncommitted changes. Deleting the worktree permanently discards them.\n\nWarning: this branch has commits not confirmed on its remote. Deleting branches may lose those commits.',
  );
});
it.each([
  { dirty: false, unpushed: false },
  { dirty: true, unpushed: false },
  { dirty: false, unpushed: true },
  { dirty: true, unpushed: true },
])(
  'discloses ignored-file deletion with dirty=$dirty and unpushed=$unpushed',
  ({ dirty, unpushed }) => {
    const description = archiveDescription({
      worktreePath: '/code/feature',
      mainCheckout: false,
      dirty,
      unpushed,
      fingerprint: 'snapshot',
    });
    expect(description).toContain(
      'The entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.',
    );
    expect(description.includes('uncommitted changes')).toBe(dirty);
    expect(description.includes('commits not confirmed')).toBe(unpushed);
  },
);
it.each([
  {
    plan: {},
    expected: 'Nothing will be deleted with the current settings.',
  },
  {
    plan: { localBranch: 'feature', detachWorktreePath: '/code/feature' },
    expected:
      'Keep worktree detached from its branch: /code/feature\n\nDelete local branch: feature',
  },
  {
    plan: { remoteBranch: 'origin/feature' },
    expected: 'Delete remote branch: origin/feature',
  },
  {
    plan: { remoteBranchNote: 'The remote branch is already deleted.' },
    expected:
      'The remote branch is already deleted.\n\nNothing will be deleted with the current settings.',
  },
])(
  'does not warn of folder deletion when the worktree is kept: $expected',
  ({ plan, expected }) => {
    expect(
      archiveDescription({
        ...plan,
        mainCheckout: false,
        dirty: false,
        unpushed: false,
        fingerprint: 'snapshot',
      }),
    ).toBe(
      `The review and its saved revisions will remain available with Show older reviews.\n\n${expected}`,
    );
  },
);
it('explains when the main checkout is protected', () => {
  expect(
    archiveDescription({
      worktreePath: undefined,
      localBranch: undefined,
      remoteBranch: undefined,
      mainCheckout: true,
      dirty: false,
      unpushed: false,
      fingerprint: 'snapshot',
    }),
  ).toBe(
    'The review and its saved revisions will remain available with Show older reviews.\n\nThe project’s main checkout and its branches are protected. Nothing will be deleted.',
  );
});

it('shows the plain refusal reason and a readable fallback', () => {
  const error = new Error(
    'Could not inspect the worktree. Nothing was deleted.',
  );
  error.name = 'ReviewArchiveRefusedError';
  expect(archiveFailureMessage(error)).toBe(
    'Could not inspect the worktree. Nothing was deleted.',
  );
  expect(archiveFailureMessage(null)).toBe(
    'Archiving failed. Try preparing the archive again.',
  );
});
