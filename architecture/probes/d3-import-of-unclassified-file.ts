import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a projects rule imports a file at the package source root, which policy does not classify',
  gate: 'arch',
  rule: 'unclassified-import-target:',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/probe-loose.ts',
      content: '',
    },
    {
      kind: 'prepend',
      path: 'packages/projects/src/rules/folder-name.ts',
      content: "import '../probe-loose.ts';\n",
    },
  ],
} satisfies Probe;
