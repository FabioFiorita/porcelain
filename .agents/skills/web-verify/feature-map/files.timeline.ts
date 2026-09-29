import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.timeline',
  route: '/',
  reach:
    'Review → Files → file → Timeline, or right-click the file → Show timeline',
  behaviour:
    'The timeline of a file lists the commits that changed it, newest first, following it back across a rename and naming the path it had, and opening one shows that commit with the diff of the file.',
  server: [
    'changes.list-file-commits',
    'changes.read-commit-files',
    'changes.read-commit-diffs',
  ],
  spec: 'apps/web/spec/browser/files-timeline.browser.ts',
} satisfies JourneyEntry;
