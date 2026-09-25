import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.rename',
  route: '/',
  reach: 'Review → Files → file → right-click → Rename',
  behaviour:
    'Renaming a file in the tree moves it on disk and shows the new name without opening it, and renaming it onto an existing name is refused and keeps both files.',
  server: ['files.edit-file', 'files.list-directory'],
  spec: 'apps/web/spec/browser/files-rename.browser.ts',
} satisfies JourneyEntry;
