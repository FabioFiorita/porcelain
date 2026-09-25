import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.mark-layer',
  route: '/',
  reach: 'Review → Layers → layer → Mark layer reviewed',
  behaviour:
    "Marking a layer of the agent's published review reviewed keeps the mark, a change to the layer's code turns it into a request to review the changed layer again, and unmarking removes the mark.",
  server: ['reviews.reviewed-layers'],
  spec: 'apps/web/spec/browser/reviews-mark-layer.browser.ts',
} satisfies JourneyEntry;
