import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile unused export',
  gate: 'arch',
  rule: 'unused-export:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/shared/worktree-empty.tsx',
      content: "\nexport function unusedMobile() { return 'unused'; }\n",
    },
  ],
} satisfies Probe;
