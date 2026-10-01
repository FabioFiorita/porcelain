import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.empty-document',
  route: '/',
  reach: 'close every tab → Open all changes or Open summary',
  behaviour:
    "With every tab closed, the empty pane offers Open all changes, which opens the worktree's changes; once the agent has published a review it offers Open summary instead, which opens the published review.",
  server: ['changes.read-changes', 'reviews.read-published-review'],
  spec: 'apps/web/spec/browser/reviews-empty-document.browser.ts',
} satisfies JourneyEntry;
