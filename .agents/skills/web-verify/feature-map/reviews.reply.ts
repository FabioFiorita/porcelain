import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.reply',
  route: '/',
  reach: "All changes → the agent's comment on a changed file → Reply",
  behaviour:
    "A blank reply cannot be posted, and a written reply to the agent's comment joins its thread and waits for the agent.",
  server: ['reviews.comment-threads'],
  spec: 'apps/web/spec/browser/reviews-reply.browser.ts',
} satisfies JourneyEntry;
