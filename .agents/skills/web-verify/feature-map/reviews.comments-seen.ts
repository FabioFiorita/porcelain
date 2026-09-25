import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.comments-seen',
  route: '/',
  reach: 'Review → Comments',
  behaviour:
    'Showing the comments list records the agent comments as seen and clears the worktree flag that the agent replied, while an agent comment seen only inline keeps the flag until the list shows it.',
  server: ['reviews.mark-comments-seen'],
  spec: 'apps/web/spec/browser/reviews-comments-seen.browser.ts',
} satisfies JourneyEntry;
