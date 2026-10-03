import type { Probe } from '../probe.ts';

export default {
  decision: 'WG4',
  plants:
    'the only feature map file for the worktree page names the root page instead, so no map names the worktree route',
  gate: 'features',
  rule: 'apps/web/src/routes/_paired/$projectId/$worktreeId.tsx: it renders the page at /$projectId/$worktreeId, which no web map file names as its route',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/features/access.restore-outage.md',
      old: 'route: /$projectId/$worktreeId\n',
      new: 'route: /\n',
    },
  ],
} satisfies Probe;
