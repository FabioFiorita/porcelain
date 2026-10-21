import { expect, it } from 'vitest';
import { archiveDescription } from './archive-review.ts';
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
    'The review and its saved revisions will remain under Closed.\n\nDelete worktree: /code/feature\n\nDelete local branch: feature\n\nDelete remote branch: origin/feature\n\nWarning: this worktree has uncommitted or ignored files. Deleting the worktree permanently discards them.\n\nWarning: this branch has commits not confirmed on its remote. Deleting branches may lose those commits.',
  );
});
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
    'The review and its saved revisions will remain under Closed.\n\nThe project’s main checkout and its branches are protected. Nothing will be deleted.',
  );
});
