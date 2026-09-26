import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.editor-reopen',
  route: '/',
  reach: 'Review → Files → README.md → Open file → Edit → close tab → reopen',
  behaviour:
    'Closing an editor saves its draft, and reopening the file starts an editor with the saved text.',
  server: ['files.read-text-file', 'files.edit-file'],
  spec: 'apps/web/spec/browser/files-editor-reopen.browser.ts',
} satisfies JourneyEntry;
