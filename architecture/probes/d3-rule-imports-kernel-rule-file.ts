import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a files rule imports a kernel rule file instead of @porcelain/kernel/rules',
  gate: 'arch',
  rule: 'kernel-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/files/src/rules/encode-base64.ts',
      content: "import '../../../kernel/src/rules/relative-path.ts';\n",
    },
  ],
} satisfies Probe;
