import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.reload-layout',
  route: '/',
  reach:
    'Review → Files → open two files → tab → right-click → Pin → collapse a diff → reload',
  behaviour:
    'Open tabs, a pinned tab and a collapsed diff are restored after the page reloads.',
  server: ['files.read-text-file', 'changes.read-change-diffs'],
  spec: 'apps/web/spec/browser/reviews-reload-layout.browser.ts',
} satisfies JourneyEntry;
