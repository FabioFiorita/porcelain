import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'a feature command reaches the shared request function instead of its API',
  gate: 'lint',
  rule: 'porcelain(web-api-owns-request)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/commands/pairing.ts',
      content:
        "import { requestJson as directRequest } from '@porcelain/client/transport';\n",
    },
  ],
} satisfies Probe;
