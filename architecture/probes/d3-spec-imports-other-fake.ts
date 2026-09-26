import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a files rule spec imports a projects fake',
  gate: 'arch',
  rule: 'test-imports-own-package-support-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/files/src/rules/encode-base64.spec.ts',
      content:
        "import '../../../projects/spec/fakes/in-memory-inventory-store.ts';\n",
    },
  ],
} satisfies Probe;
