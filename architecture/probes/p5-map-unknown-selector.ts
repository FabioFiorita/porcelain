import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a feature map names a selector the app never renders',
  gate: 'features',
  rule: '.agents/skills/web-verify/features/projects.rename.md: selector "Retitle project" appears nowhere',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/features/projects.rename.md',
      old: '  - "Rename project"\n',
      new: '  - "Retitle project"\n',
    },
  ],
} satisfies Probe;
