import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'git shared/commands/identity.ts imports process run-command.ts by path instead of the package entry',
  gate: 'arch',
  rule: 'process-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/src/shared/commands/identity.ts',
      content: "import '../../../../process/src/commands/run-command.ts';\n",
    },
  ],
} satisfies Probe;
