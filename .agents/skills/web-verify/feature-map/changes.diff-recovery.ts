import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.diff-recovery',
  route: '/',
  reach: 'Review → All changes, while another writer changes a file before the diff request reaches the server',
  behaviour:
    'A worktree change during diff loading refreshes the change list once and shows the new diff without leaving a loading or failure notice.',
  server: ['changes.read-changes', 'changes.read-change-diffs'],
  spec: 'apps/web/spec/browser/changes-diff-recovery.browser.ts',
} satisfies JourneyEntry;
