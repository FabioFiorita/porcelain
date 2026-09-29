import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.readiness-outdated',
  route: '/',
  reach: 'Review → Readiness',
  behaviour:
    'A question the agent is waiting on you to answer and checks that ran before the latest changes keep the readiness panel from clearing, and the proof says when it was published and that its checks are out of date.',
  server: ['reviews.proof-current'],
  spec: 'apps/web/spec/browser/reviews-readiness-outdated.browser.ts',
} satisfies JourneyEntry;
