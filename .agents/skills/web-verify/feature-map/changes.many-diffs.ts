import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.many-diffs',
  route: '/',
  reach:
    'Review → All changes, in a worktree with more tracked changes than one diff request holds',
  behaviour:
    'All changes reads the diffs of more tracked changes than one request may carry in several requests and shows them.',
  server: ['changes.read-changes', 'changes.read-change-diffs'],
  spec: 'apps/web/spec/browser/changes-many-diffs.browser.ts',
} satisfies JourneyEntry;
