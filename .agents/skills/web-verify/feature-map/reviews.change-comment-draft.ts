import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.change-comment-draft',
  route: '/',
  reach:
    'Review → Comments → Branch → Comment on the whole branch, while the agent commits',
  behaviour:
    'A comment on the whole branch being written survives a new commit on the branch and is saved against the tip the branch has when it is posted.',
  server: ['reviews.change-comments', 'changes.read-branch-changes'],
  spec: 'apps/web/spec/browser/reviews-change-comment-draft.browser.ts',
} satisfies JourneyEntry;
