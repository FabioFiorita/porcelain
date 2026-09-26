import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.stash',
  route: '/',
  reach:
    'Git actions → Stash changes → Stash changes, then Git actions → Pop stash → Pop stash',
  behaviour:
    'Stashing sets the changes aside and popping the stash brings them back, while popping over a file changed since is refused with what Git said and keeps the stash.',
  server: ['changes.read-git-status', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-stash.browser.ts',
} satisfies JourneyEntry;
