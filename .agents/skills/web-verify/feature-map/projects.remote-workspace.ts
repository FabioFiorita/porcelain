import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.remote-workspace',
  route: '/remotes/$environmentId/$projectId/$worktreeId',
  reach:
    'Settings → Remote computers → Add, then Toggle Sidebar → the remote computer → its worktree',
  shell: 'desktop',
  behaviour:
    "The desktop app lists another computer under its own name and status in the sidebar, apart from this computer's projects, and opens its worktree in the full review workspace over that computer's own credential, with the machine in the tab title: a change marked reviewed lands on that computer only, and what changes there shows live through a live ticket, without a reload.",
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
