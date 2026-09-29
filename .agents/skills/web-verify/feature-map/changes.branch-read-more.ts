import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.branch-read-more',
  route: '/',
  reach: 'Review → Changes → Branch → All branch changes → Read more',
  behaviour:
    'Reading more of a long branch keeps the diffs already shown on screen while the next ones load, and reads only the files it had not read yet.',
  server: ['changes.read-branch-changes', 'changes.read-branch-diffs'],
  spec: 'apps/web/spec/browser/changes-branch-read-more.browser.ts',
} satisfies JourneyEntry;
