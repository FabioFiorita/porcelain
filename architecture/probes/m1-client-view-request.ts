import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'a native view reaches the shared request API instead of a command',
  gate: 'arch',
  rule: 'view-cannot-import-client-request-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/access/views/settings-screen.tsx',
      content: "import '@porcelain/client/access/api';\n",
    },
  ],
} satisfies Probe;
