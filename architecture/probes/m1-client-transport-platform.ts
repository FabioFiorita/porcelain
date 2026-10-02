import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'the shared transport imports native UI instead of receiving platform capabilities',
  gate: 'lint',
  rule: 'porcelain(client-platform-through-ports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/shared/api/transport.ts',
      content: "import '@expo/ui';\n",
    },
  ],
} satisfies Probe;
