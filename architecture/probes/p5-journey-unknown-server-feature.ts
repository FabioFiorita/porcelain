import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a journey relies on a server feature id the server net does not define',
  gate: 'web-verify',
  feature: 'projects.rename',
  rule: 'feature-map/projects.rename.ts relies on server features the server net does not define: projects.retitle',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/feature-map/projects.rename.ts',
      old: "  server: ['projects.rename'],",
      new: "  server: ['projects.retitle'],",
    },
  ],
} satisfies Probe;
