import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.reload-running',
  route: '/',
  reach:
    'Commit → Commit selected files → reload before the app hears its outcome → Commit',
  behaviour:
    'A Git action still running when the page reloads is still followed after the reload: the commit form waits for its outcome and refuses another commit, then shows how it ended once the app reads its receipt.',
  server: ['git-actions.run-action', 'git-actions.read-receipt'],
  spec: 'apps/web/spec/browser/git-actions-reload-running.browser.ts',
} satisfies JourneyEntry;
