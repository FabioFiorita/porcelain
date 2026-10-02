import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'a native file view reaches the shared transport instead of forwarding an event',
  gate: 'arch',
  rule: 'view-cannot-import-client-transport-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/files/views/files-screen.tsx',
      content: "import '@porcelain/client/transport';\n",
    },
  ],
} satisfies Probe;
