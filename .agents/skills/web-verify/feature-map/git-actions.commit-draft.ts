import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.commit-draft',
  route: '/',
  reach: 'Commit → Commit model, Generate with AI, Use groups',
  behaviour:
    'Without a coding CLI on the server the commit dialog says no model is available and keeps drafting and groups disabled, and a message typed by hand still commits.',
  server: ['git-actions.list-commit-models', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-commit-draft.browser.ts',
} satisfies JourneyEntry;
