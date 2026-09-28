import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.stale-draft',
  route: '/',
  reach: 'Commit → Generate with AI → Commit selected files → Look again',
  behaviour:
    'A drafted message whose files no longer match what the dialog looked at is flagged as stale and blocks the commit until the dialog looks again or the message is generated again, so a commit never pairs a draft with files it did not describe.',
  server: [
    'git-actions.list-commit-models',
    'git-actions.generate-commit-draft',
    'git-actions.run-action',
  ],
  spec: 'apps/web/spec/browser/git-actions-stale-draft.browser.ts',
} satisfies JourneyEntry;
