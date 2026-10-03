import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the desktop shell reaches directly into server storage',
  gate: 'arch',
  rule: 'desktop-cannot-import-repository-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/desktop/src/main.ts',
      content: "import '../../../packages/storage/src/index.ts';\n",
    },
  ],
} satisfies Probe;
