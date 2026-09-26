import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the changes comparisons fixture imports the projects models',
  gate: 'arch',
  rule: 'fixture-imports-own-package-models-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/changes/spec/fixtures/comparisons.ts',
      content: "import '../../../projects/src/models/index.ts';\n",
    },
  ],
} satisfies Probe;
