import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a feature map entry without the path a user takes to reach the journey',
  gate: 'web-verify',
  feature: 'projects.rename',
  rule: 'feature-map/projects.rename.ts: reach:',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/feature-map/projects.rename.ts',
      old: "  reach: 'sidebar → project → right-click → Rename project',\n",
      new: '',
    },
  ],
} satisfies Probe;
