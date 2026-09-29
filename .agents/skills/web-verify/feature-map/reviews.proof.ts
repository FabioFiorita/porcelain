import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.proof',
  route: '/',
  reach: 'Review → Layers → Proof',
  behaviour:
    'The checks and screenshot the agent published with its review show under Proof, and a failing check stands out first with its output.',
  server: ['reviews.proof'],
  spec: 'apps/web/spec/browser/reviews-proof.browser.ts',
} satisfies JourneyEntry;
