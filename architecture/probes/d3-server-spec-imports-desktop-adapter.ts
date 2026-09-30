import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a server spec imports the desktop encrypted credentials adapter',
  gate: 'arch',
  rule: 'test-cannot-import-desktop-gateway:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/http/error-handler.spec.ts',
      content:
        "import '../../../desktop/src/adapters/encrypted-credentials.ts';\n",
    },
  ],
} satisfies Probe;
