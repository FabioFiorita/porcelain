import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.changed-file-menu',
  route: '/',
  reach: 'Review → Changes → right-click a changed file',
  behaviour:
    'Right-clicking a changed file marks it reviewed and offers to unmark it, starts a comment on the file, and opens its timeline.',
  server: ['reviews.reviewed-files', 'changes.list-file-commits'],
  spec: 'apps/web/spec/browser/reviews-changed-file-menu.browser.ts',
} satisfies JourneyEntry;
