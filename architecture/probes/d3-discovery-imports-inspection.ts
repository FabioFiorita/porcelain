import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'git discovery imports inspection, against the capability order',
  gate: 'arch',
  rule: 'git-capability-dependency-order:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/src/discovery/discovery-git.ts',
      content: "import '../inspection/index.ts';\n",
    },
  ],
} satisfies Probe;
