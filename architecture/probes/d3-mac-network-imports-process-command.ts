import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the Mac network gateway bypasses the process public API',
  gate: 'arch',
  rule: 'process-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/access/mac-network-command.ts',
      content:
        "import '../../../../../packages/process/src/commands/read-command.ts';\n",
    },
  ],
} satisfies Probe;
