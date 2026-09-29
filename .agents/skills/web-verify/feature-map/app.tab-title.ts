import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.tab-title',
  route: '/',
  reach:
    'The browser tab while a worktree is open → Files → README.md → Open file, then History → a commit',
  behaviour:
    'The browser tab is titled after the open file, commit or surface, followed by the project.',
  server: [
    'projects.inventory',
    'files.read-text-file',
    'changes.list-commits',
  ],
  spec: 'apps/web/spec/browser/app-tab-title.browser.ts',
} satisfies JourneyEntry;
