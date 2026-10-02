import type { Probe } from '../probe.ts';

export default {
  decision: 'S5',
  plants:
    'a desktop e2e test reaches the server kit itself instead of through the desktop fixtures',
  gate: 'arch',
  rule: 'package-cannot-import-server:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/desktop/spec/e2e/window.e2e.ts',
      content: "import '@porcelain/server/kit/owner';\n",
    },
  ],
} satisfies Probe;
