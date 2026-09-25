import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.switch-branch',
  route: '/',
  reach: 'Git actions → Switch branch → Branch → Switch branch',
  behaviour:
    'Switching branch lists the local branches with the current one unavailable, moves the worktree onto the chosen one, and is refused with what Git said when it would overwrite a local file.',
  server: ['git-actions.list-branches', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-switch-branch.browser.ts',
} satisfies JourneyEntry;
