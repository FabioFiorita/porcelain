import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.create-branch',
  route: '/',
  reach: 'Git actions → Create branch → Branch name → Create branch',
  behaviour:
    'Creating a branch from the web switches the worktree onto it, and a name that is already taken is refused with what Git said while no branch is created.',
  server: ['git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-create-branch.browser.ts',
} satisfies JourneyEntry;
