import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'the web reaches a shared client rule through its private source path',
  gate: 'arch',
  rule: 'client-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/api.ts',
      content:
        "import '../../../../../packages/client/src/features/access/rules/pairing-link.ts';\n",
    },
  ],
} satisfies Probe;
