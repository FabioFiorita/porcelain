import type { Probe } from '../probe.ts';

export default {
  decision: 'WG4',
  plants:
    'the only feature map entry for the worktree page names the root page instead, so no entry names the worktree route',
  gate: 'web-lint',
  rule: 'style(web-feature-map)',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/feature-map/access.restore-outage.ts',
      old: "  route: '/$projectId/$worktreeId',\n",
      new: "  route: '/',\n",
    },
  ],
} satisfies Probe;
