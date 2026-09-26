import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'history.browse',
  route: '/',
  reach: 'Review → History',
  shortcut: 'Alt+3',
  behaviour:
    'History lists the checked-out branch down to the start of history, shows a commit made on disk as it lands, and drops it when the worktree switches to a branch without it.',
  server: ['changes.list-commits'],
  spec: 'apps/web/spec/browser/history-browse.browser.ts',
} satisfies JourneyEntry;
