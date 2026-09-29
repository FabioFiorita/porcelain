import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'history.list',
  route: '/',
  reach: 'Review → History',
  behaviour:
    'The History list gives each commit its message, short id, author, age and ref chips without a graph beside it, and marks a merge commit with a merge icon.',
  server: ['changes.list-commits'],
  spec: 'apps/web/spec/browser/history-list.browser.ts',
} satisfies JourneyEntry;
