import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'git inspection imports a discovery dto by path instead of discovery/index.ts',
  gate: 'arch',
  rule: 'git-capability-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/src/inspection/inspection-git.ts',
      content: "import '../discovery/dtos/discovery-result.ts';\n",
    },
  ],
} satisfies Probe;
