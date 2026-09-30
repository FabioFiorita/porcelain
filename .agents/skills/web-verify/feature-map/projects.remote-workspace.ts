import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.remote-workspace',
  route: '/remotes/$environmentId/$projectId/$worktreeId',
  reach:
    'Settings → Remote computers → Add, then Toggle Sidebar → the remote computer → its worktree',
  shell: 'desktop',
  behaviour:
    'The desktop app lists each remote computer under its name and status in the sidebar, next to this computer, and opens its worktree in the full review workspace over its own credential: it marks a change reviewed there across origins and shows what changes on it through a live ticket, without a reload.',
  server: [
    'access.pairing',
    'access.environment',
    'access.live-tickets',
    'projects.inventory',
    'reviews.reviewed-files',
    'files.read-text-file',
  ],
  spec: 'apps/web/spec/browser/projects-remote-workspace.browser.ts',
} satisfies JourneyEntry;
