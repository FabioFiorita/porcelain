import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the files file-reader fake imports the projects models',
  gate: 'arch',
  rule: 'fake-imports-own-package-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/files/spec/fakes/in-memory-file-reader.ts',
      content: "import '../../../projects/src/models/index.ts';\n",
    },
  ],
} satisfies Probe;
