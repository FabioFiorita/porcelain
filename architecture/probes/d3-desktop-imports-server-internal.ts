import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'the desktop shell bypasses the server desktop public API',
  gate: 'arch',
  rule: 'package-cannot-import-server:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/desktop/src/main.ts',
      content: "import '../../server/src/bootstrap/compose-server.ts';\n",
    },
  ],
} satisfies Probe;
