import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.trash',
  route: '/',
  reach: 'Review → Files → file → right-click → Move to trash → Move to trash',
  behaviour:
    'Moving a file to the trash from the tree removes it from disk and the tree, and moving one another writer already removed is refused and says so.',
  server: ['files.edit-file', 'files.list-directory'],
  spec: 'apps/web/spec/browser/files-trash.browser.ts',
} satisfies JourneyEntry;
