import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.change-comment',
  route: '/',
  reach:
    'Review → Comments → Comment on the whole change (Uncommitted) or Comment on the whole branch (Branch)',
  behaviour:
    'A comment on the whole uncommitted change is saved without a file and waits for the agent, and one on the whole branch is saved against its base and the tip it was read at.',
  server: ['reviews.change-comments'],
  spec: 'apps/web/spec/browser/reviews-change-comment.browser.ts',
} satisfies JourneyEntry;
