import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.find-refresh',
  route: '/',
  reach:
    'Review → Files → a file → right-click → Open file → Mod+F, while the file changes on disk',
  shortcut: 'Mod+F',
  behaviour:
    'When the file changes on disk under an open find, the count follows the new text and never names a match past its last one.',
  server: ['files.read-text-file'],
  spec: 'apps/web/spec/browser/files-find-refresh.browser.ts',
} satisfies JourneyEntry;
