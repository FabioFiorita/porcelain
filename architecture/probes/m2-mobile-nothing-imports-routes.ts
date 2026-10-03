import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile nothing imports routes',
  gate: 'arch',
  rule: 'mobile-nothing-imports-routes:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/shell/phone-tabs.tsx',
      content: "import '../app/(files)/files';\n",
    },
  ],
} satisfies Probe;
