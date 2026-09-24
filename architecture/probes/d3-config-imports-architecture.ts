import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'server config/limits.ts imports architecture/policy.ts, a file outside every source root',
  gate: 'arch',
  rule: 'import-outside-source-roots:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/config/limits.ts',
      content: "import '../../../../architecture/policy.ts';\n",
    },
  ],
} satisfies Probe;
