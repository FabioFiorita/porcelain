import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'web coverage stops following the shared client public runtime exports',
  gate: 'web-verify',
  feature: 'app.shell',
  rule: 'route discovery: runtime client exports and demanded reexports:',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/scripts/web-routes.ts',
      old: "join(root, 'packages/client', exported)",
      new: 'undefined',
    },
  ],
} satisfies Probe;
