import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'a client integration spec reaches the server bootstrap instead of its public kit',
  gate: 'arch',
  rule: 'client-imports-client-and-contracts-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/spec/integration/files.integration.ts',
      content: "import '@porcelain/server/desktop';\n",
    },
  ],
} satisfies Probe;
