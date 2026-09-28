import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.layer-graph',
  route: '/',
  reach: 'Review → Layers → layer → Graph',
  behaviour:
    "The Graph tab of a layer of the agent's published review loads the diagram and draws the layer's lane and step, and choosing the step shows its code beside the diagram.",
  server: ['reviews.read-published-review'],
  spec: 'apps/web/spec/browser/reviews-layer-graph.browser.ts',
} satisfies JourneyEntry;
