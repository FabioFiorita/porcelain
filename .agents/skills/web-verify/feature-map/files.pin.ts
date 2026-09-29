import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.pin',
  route: '/',
  reach:
    'Review → Files → a file → right-click → Pin file, then Pinned → Unpin',
  behaviour:
    'Pinning a file lists it under Pinned above the file tree, where it opens the file, and the server keeps it pinned for the project until it is unpinned.',
  server: ['projects.file-preferences'],
  spec: 'apps/web/spec/browser/files-pin.browser.ts',
} satisfies JourneyEntry;
