import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the projects.rename journey claims projects.remove, whose route it never reaches',
  gate: 'web-verify',
  feature: 'projects.rename',
  rule: 'projects.rename: claims projects.remove: the journey reached none of its routes',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/feature-map/projects.rename.ts',
      old: "  server: ['projects.rename'],",
      new: "  server: ['projects.rename', 'projects.remove'],",
    },
  ],
} satisfies Probe;
