import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.commit-branch-moved',
  route: '/',
  reach: 'Commit → Message → Commit selected files',
  behaviour:
    'A commit expects the branch the dialog looked at when it opened, so switching the worktree to another branch on the same commit afterwards makes the commit refused as changed since looked.',
  server: ['git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-commit-branch-moved.browser.ts',
} satisfies JourneyEntry;
