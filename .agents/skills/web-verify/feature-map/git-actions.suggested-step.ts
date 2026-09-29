import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.suggested-step',
  route: '/',
  reach:
    'The Git button beside Git actions, once the changes are stashed → Apply stash',
  behaviour:
    'Once nothing is left to commit, pull or push, the Git button suggests applying the waiting stash, and following it brings the stashed changes back.',
  server: ['changes.read-git-status', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-suggested-step.browser.ts',
} satisfies JourneyEntry;
