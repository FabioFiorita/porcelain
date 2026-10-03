import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a feature map file without its Gotchas section',
  gate: 'features',
  rule: '.agents/skills/web-verify/features/projects.rename.md: its sections are',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/features/projects.rename.md',
      old: '## Gotchas\n',
      new: '## Pitfalls\n',
    },
  ],
} satisfies Probe;
