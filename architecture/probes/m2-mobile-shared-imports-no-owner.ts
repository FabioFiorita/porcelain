import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile shared imports no owner',
  gate: 'arch',
  rule: 'mobile-shared-imports-no-owner:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/shared/worktree-empty.tsx',
      content: "import '../features/files';\n",
    },
  ],
} satisfies Probe;
