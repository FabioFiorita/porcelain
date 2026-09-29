import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.review-branch',
  route: '/',
  reach: 'Review → Changes → Branch → file',
  behaviour:
    'Reviewing the branch lists every file committed since it forked from the default branch, opens the diff of one, marks it reviewed in the branch review without touching the uncommitted review, and saves a comment on it against the branch comparison.',
  server: [
    'changes.read-branch-changes',
    'changes.read-branch-diffs',
    'reviews.branch-reviewed-files',
    'reviews.comment-threads',
  ],
  spec: 'apps/web/spec/browser/changes-review-branch.browser.ts',
} satisfies JourneyEntry;
