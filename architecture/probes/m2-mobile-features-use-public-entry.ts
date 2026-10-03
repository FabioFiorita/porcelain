import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile features use public entry',
  gate: 'arch',
  rule: 'mobile-features-import-feature-index:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/files/views/files-screen.tsx',
      content: "import '../../reviews/views/review-screen';\n",
    },
  ],
} satisfies Probe;
