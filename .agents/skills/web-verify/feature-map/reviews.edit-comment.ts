import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.edit-comment',
  route: '/',
  reach: 'All changes → your comment → Comment actions → Edit or Delete',
  behaviour:
    "The reviewer rewrites their own comment, which shows as edited and is saved with the new text, then deletes it, which removes the thread, while the agent's comment offers neither.",
  server: ['reviews.edit-comments'],
  spec: 'apps/web/spec/browser/reviews-edit-comment.browser.ts',
} satisfies JourneyEntry;
