import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.edit',
  route: '/',
  reach: 'Review → Files → README.md → right-click → Open file → Edit',
  shortcut: 'Mod+S',
  behaviour:
    'Editing a file saves after a pause, with Done and when its tab closes, and the server holds each saved text.',
  server: ['files.read-text-file', 'files.edit-file'],
  spec: 'apps/web/spec/browser/files-edit.browser.ts',
} satisfies JourneyEntry;
