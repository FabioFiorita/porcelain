import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.discard',
  route: '/',
  reach: 'Review → changed file → Discard → Discard, then Restore',
  behaviour:
    'Discarding a changed file returns it to the last commit and Restore brings the change back, while a file that changed after the dialog opened is refused and keeps its newer text.',
  server: ['git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-discard.browser.ts',
} satisfies JourneyEntry;
