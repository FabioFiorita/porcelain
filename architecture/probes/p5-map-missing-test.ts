import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a feature map names a test file that does not exist',
  gate: 'features',
  rule: '.agents/skills/web-verify/features/projects.rename.md: test apps/web/spec/integration/projects-retitle.test.tsx does not exist',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/web-verify/features/projects.rename.md',
      old: '  - apps/web/spec/integration/projects-rename.test.tsx\n',
      new: '  - apps/web/spec/integration/projects-retitle.test.tsx\n',
    },
  ],
} satisfies Probe;
