import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.follow-receipt',
  route: '/',
  reach:
    'Git actions → Create branch → Create branch while the live connection is down, then it reconnects',
  behaviour:
    'A Git action that settles while the live connection is down stays in progress until the app reconnects, then the app reads its receipt and shows how it ended, whether it succeeded or Git refused it.',
  server: ['git-actions.run-action', 'git-actions.read-receipt'],
  spec: 'apps/web/spec/browser/git-actions-follow-receipt.browser.ts',
} satisfies JourneyEntry;
