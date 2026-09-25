import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'changes.live-update',
  route: '/',
  reach:
    'Review → Files → README.md → right-click → Open file, while another writer changes the worktree on disk',
  behaviour:
    'While the page stays open, a file another writer rewrites, creates or removes on disk shows its new text, or appears in or leaves the file tree and the changes list, through the live-update socket and without a reload.',
  server: [
    'access.live-updates',
    'changes.read-changes',
    'files.list-directory',
    'files.read-text-file',
  ],
  spec: 'apps/web/spec/browser/changes-live-update.browser.ts',
} satisfies JourneyEntry;
