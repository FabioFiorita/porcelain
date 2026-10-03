import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'process run-command.ts imports the server limits',
  gate: 'arch',
  rule: 'package-cannot-import-server:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/process/src/commands/run-command.ts',
      content: "import '../../../../apps/server/src/config/limits.ts';\n",
    },
  ],
} satisfies Probe;
