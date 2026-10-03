import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile imports no app',
  gate: 'arch',
  rule: 'mobile-imports-mobile-client-and-contracts-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/shared/worktree-empty.tsx',
      content: "import '../../../web/src/features/files';\n",
    },
  ],
} satisfies Probe;
