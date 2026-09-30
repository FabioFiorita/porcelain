import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.pin',
  route: '/',
  reach:
    'Review → Files → a file → right-click → Pin file, then Pinned → right-click, then Unpin',
  behaviour:
    'Pinning a file lists it under Pinned above the file tree, where it opens the file and offers the same commands as the tree with Unpin file in place of Pin file, and the server keeps it pinned for the project until it is unpinned.',
  server: ['projects.file-preferences'],
  spec: 'apps/web/spec/browser/files-pin.browser.ts',
} satisfies JourneyEntry;
