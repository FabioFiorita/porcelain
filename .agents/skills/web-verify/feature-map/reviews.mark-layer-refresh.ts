import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.mark-layer-refresh',
  route: '/',
  reach: 'Review → Layers → layer → Mark changed layer reviewed',
  behaviour:
    'While the published layer is read again after its code changed, its mark button waits for the new layer, so the mark is sent with the fingerprint of the layer on screen and is accepted.',
  server: ['reviews.reviewed-layers', 'reviews.read-published-review'],
  spec: 'apps/web/spec/browser/reviews-mark-layer-refresh.browser.ts',
} satisfies JourneyEntry;
