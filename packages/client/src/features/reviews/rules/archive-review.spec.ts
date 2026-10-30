import { expect, it } from 'vitest';
import { archiveDescription, archiveFailureMessage } from './archive-review.ts';
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
