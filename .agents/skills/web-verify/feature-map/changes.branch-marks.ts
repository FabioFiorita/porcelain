import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.branch-marks',
  route: '/',
  reach: 'Review → Changes → Branch → file → Mark reviewed',
  behaviour:
    'A file marked reviewed in the branch review stays reviewed only on that branch: another branch in the same worktree starts its review fresh, and switching back shows the mark again.',
  server: ['changes.read-branch-changes', 'reviews.branch-marks-over-time'],
  spec: 'apps/web/spec/browser/changes-branch-marks.browser.ts',
} satisfies JourneyEntry;
