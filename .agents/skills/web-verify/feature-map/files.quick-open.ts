import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.quick-open',
  route: '/',
  reach: 'Review → Files → Mod+P → Find a file by name',
  shortcut: 'Mod+P',
  behaviour:
    'Quick open finds a worktree file by name and opens it, and finds no file an ignore rule hides.',
  server: ['files.list-worktree-paths', 'files.read-text-file'],
  spec: 'apps/web/spec/browser/files-quick-open.browser.ts',
} satisfies JourneyEntry;
