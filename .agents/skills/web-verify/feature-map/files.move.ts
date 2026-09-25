import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.move',
  route: '/',
  reach: 'Review → Files → drag a file onto a folder',
  behaviour:
    'Dragging a file onto a folder in the tree moves it into that folder on disk without opening it, and dragging one onto a folder that already holds that name is refused and keeps both files.',
  server: ['files.edit-file', 'files.list-directory'],
  spec: 'apps/web/spec/browser/files-move.browser.ts',
} satisfies JourneyEntry;
