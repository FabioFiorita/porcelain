import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.commit',
  route: '/',
  reach: 'Commit → Message → Commit selected files',
  behaviour:
    'A commit with a typed message from the web succeeds and becomes the newest commit in the real repository history.',
  server: ['git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-commit.browser.ts',
} satisfies JourneyEntry;
