import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.editor-reopen',
  route: '/',
  reach: 'Review → Files → README.md → Open file → Edit → close tab → reopen',
  behaviour:
    'A live editor keeps its draft ownership across panes; closing it saves the draft, and reopening starts an editor with the saved text.',
  server: ['files.read-text-file', 'files.edit-file'],
  spec: 'apps/web/spec/browser/files-editor-reopen.browser.ts',
} satisfies JourneyEntry;
