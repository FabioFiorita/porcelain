import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a files rule imports the files wire contract, a domain depending on transport',
  gate: 'arch',
  rule: 'domain-cannot-import-transport-contract:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/files/src/rules/move-problem.ts',
      content: "import '../../../contracts/src/files/index.ts';\n",
    },
  ],
} satisfies Probe;
