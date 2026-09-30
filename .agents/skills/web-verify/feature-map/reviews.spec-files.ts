import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.spec-files',
  route: '/',
  reach: 'Toggle Sidebar → Settings → Appearance → Spec files',
  behaviour:
    'Turning on Spec files in Settings lists changed spec files after the other changed files.',
  server: ['changes.read-changes'],
  spec: 'apps/web/spec/browser/reviews-spec-files.browser.ts',
} satisfies JourneyEntry;
