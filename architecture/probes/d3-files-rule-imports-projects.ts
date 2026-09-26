import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a files rule imports the projects models, one domain reaching into another',
  gate: 'arch',
  rule: 'domain-cannot-import-another-domain:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/files/src/rules/encode-base64.ts',
      content: "import '../../../projects/src/models/index.ts';\n",
    },
  ],
} satisfies Probe;
