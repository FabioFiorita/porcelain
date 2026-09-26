import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.step-lines',
  route: '/',
  reach: 'Review → Review → layer → step, after an agent published a review',
  behaviour:
    'A published review step that points at worktree lines shows those lines as they are on disk, and says the code changed once another writer rewrites them.',
  server: ['changes.read-change-lines', 'reviews.read-published-review'],
  spec: 'apps/web/spec/browser/changes-step-lines.browser.ts',
} satisfies JourneyEntry;
