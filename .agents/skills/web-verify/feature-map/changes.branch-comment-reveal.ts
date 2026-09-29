import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.branch-comment-reveal',
  route: '/',
  reach: 'Review → Changes → Comments → branch comment',
  behaviour:
    'Showing a comment written on the branch review opens its file against the base the comment was written against, even after the reviewer chose another base.',
  server: ['changes.read-branch-changes', 'reviews.comment-threads'],
  spec: 'apps/web/spec/browser/changes-branch-comment-reveal.browser.ts',
} satisfies JourneyEntry;
