import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.mark-all',
  route: '/',
  reach: 'All changes → Mark all reviewed',
  behaviour:
    'Marking all changed files reviewed marks every one in one step, a file that changes on disk afterwards is offered for review again, and unmarking all clears every mark.',
  server: ['reviews.reviewed-files'],
  spec: 'apps/web/spec/browser/reviews-mark-all.browser.ts',
} satisfies JourneyEntry;
