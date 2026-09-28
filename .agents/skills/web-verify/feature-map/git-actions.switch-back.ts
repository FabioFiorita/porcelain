import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.switch-back',
  route: '/',
  reach: 'Git actions → Switch branch → Branch → Switch branch',
  behaviour:
    'Switching back to the branch the worktree started on moves the worktree onto it again.',
  server: ['git-actions.list-branches', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-switch-back.browser.ts',
} satisfies JourneyEntry;
