import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'history.graph',
  route: '/',
  reach: 'Review → History → Open graph → commit',
  behaviour:
    'Open graph opens the commit graph of the branch as a document tab with its lanes, merges and refs, the tab comes back after a reload, and clicking a commit in it opens that commit.',
  server: ['changes.list-commits', 'changes.read-commit-files'],
  spec: 'apps/web/spec/browser/history-graph.browser.ts',
} satisfies JourneyEntry;
