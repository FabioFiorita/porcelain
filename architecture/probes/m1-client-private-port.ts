import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'an app bypasses the shared feature entry to reach a private platform port',
  gate: 'arch',
  rule: 'client-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/store.ts',
      content:
        "import '../../../../../packages/client/src/features/access/ports/pairing-platform.ts';\n",
    },
  ],
} satisfies Probe;
