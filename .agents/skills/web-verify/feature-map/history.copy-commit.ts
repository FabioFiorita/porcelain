import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'history.copy-commit',
  route: '/',
  reach:
    'Review → History → right-click a commit → Copy commit id or Copy message, and the commit document → Copy id or Copy message',
  behaviour:
    "A commit's full id or its whole message is copied from its History row and from its commit document.",
  server: ['changes.list-commits', 'changes.read-commit-files'],
  spec: 'apps/web/spec/browser/history-copy-commit.browser.ts',
} satisfies JourneyEntry;
