import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.duplicate',
  route: '/',
  reach:
    'Review → Files → a file → right-click → Duplicate, or Mod+D on the open file',
  shortcut: 'Mod+D',
  behaviour:
    'Duplicating a file writes a copy named after it beside it and opens the copy, from the file menu or with Mod+D on the open file.',
  server: ['files.duplicate-file', 'files.list-directory'],
  spec: 'apps/web/spec/browser/files-duplicate.browser.ts',
} satisfies JourneyEntry;
