import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.open-linked-worktree',
  route: '/',
  reach:
    'empty workspace → sidebar → Open project → Browse for a folder → repository with a linked worktree → Open',
  behaviour:
    'Opening a repository with a linked worktree from the empty workspace shows the worktree the dialog opened, and leaves no empty workspace behind in the history.',
  server: ['projects.remove', 'projects.register'],
  spec: 'apps/web/spec/browser/projects-open-linked-worktree.browser.ts',
} satisfies JourneyEntry;
