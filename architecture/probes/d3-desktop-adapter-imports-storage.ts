import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the desktop window preferences adapter reaches into server storage',
  gate: 'arch',
  rule: 'desktop-gateway-cannot-import-repository-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/desktop/src/adapters/window-state.ts',
      content: "import '../../../../packages/storage/src/index.ts';\n",
    },
  ],
} satisfies Probe;
