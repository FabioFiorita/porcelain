import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.open-remote',
  route: '/remotes/$environmentId/$projectId/$worktreeId',
  reach:
    'Toggle Sidebar → Open project → the remote computer → Browse for a folder → folder → Open',
  shell: 'desktop',
  behaviour:
    "With a remote computer added, the desktop app's Open project button becomes a menu of This computer and each remote computer by name: choosing a remote computer browses that computer's own folders and registers the repository on it alone, then opens its worktree, while This computer still opens a project on this computer.",
  server: [
    'access.pairing',
    'access.environment',
    'projects.inventory',
    'projects.browse-folders',
    'projects.register',
  ],
  spec: 'apps/web/spec/browser/projects-open-remote.browser.ts',
} satisfies JourneyEntry;
