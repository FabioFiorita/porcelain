import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'git shared/commands/identity.ts imports the projects models',
  gate: 'arch',
  rule: 'git-cannot-import-domain:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/src/shared/commands/identity.ts',
      content: "import '../../../../projects/src/models/index.ts';\n",
    },
  ],
} satisfies Probe;
