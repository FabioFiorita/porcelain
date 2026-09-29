import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.find',
  route: '/',
  reach:
    'Review → Files → a long file → right-click → Open file → Mod+F, then Edit → Mod+F',
  shortcut: 'Mod+F',
  behaviour:
    'Finding in a long file counts its matches and brings a match far below the fold into view, in the file view and in the editor.',
  server: ['files.read-text-file'],
  spec: 'apps/web/spec/browser/files-find.browser.ts',
} satisfies JourneyEntry;
