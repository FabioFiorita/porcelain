import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.edit-conflict',
  route: '/',
  reach:
    'Review → Files → README.md → right-click → Open file → Edit, while the file changes on disk',
  behaviour:
    'Saving an edit to a file that changed on disk since it was opened is refused, the editor says so and keeps the draft, and the disk keeps the other change.',
  server: ['files.edit-file'],
  spec: 'apps/web/spec/browser/files-edit-conflict.browser.ts',
} satisfies JourneyEntry;
