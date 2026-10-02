import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants:
    'a native command reaches private storage instead of the configured feature state',
  gate: 'arch',
  rule: 'command-cannot-import-adapter:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/features/access/commands/pairing.ts',
      content: "import '../adapters/environment-storage';\n",
    },
  ],
} satisfies Probe;
