import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.comment',
  route: '/',
  reach: 'All changes → changed file → Comment',
  shortcut: 'C',
  behaviour:
    'A blank comment cannot be posted, and a written comment on a changed file is saved on that file and shown waiting for the agent.',
  server: ['reviews.comment-threads'],
  spec: 'apps/web/spec/browser/reviews-comment.browser.ts',
} satisfies JourneyEntry;
