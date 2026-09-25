import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.dismiss-interrupted',
  route: '/',
  reach:
    'a Git action that ends interrupted → Review content → A Git action was interrupted → Got it',
  behaviour:
    'A Git action that outlives its deadline ends interrupted, the review shows a notice naming it until Got it dismisses it, and the server keeps its receipt.',
  server: ['git-actions.run-action', 'git-actions.dismiss-interrupted'],
  spec: 'apps/web/spec/browser/git-actions-dismiss-interrupted.browser.ts',
} satisfies JourneyEntry;
