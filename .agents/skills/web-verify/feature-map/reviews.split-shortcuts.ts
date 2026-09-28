import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.split-shortcuts',
  route: '/',
  reach: 'Review → Files → README.md → Open file → tab → Open to the side',
  shortcut: 'Alt+W',
  behaviour:
    'In a split view the tab shortcuts act on the focused pane alone, and opening the split registers them once.',
  server: ['files.list-directory', 'files.read-text-file'],
  spec: 'apps/web/spec/browser/reviews-split-shortcuts.browser.ts',
} satisfies JourneyEntry;
