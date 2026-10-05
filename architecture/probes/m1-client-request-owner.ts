import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants:
    'a feature command constructs the typed HTTP client instead of using its shared feature API',
  gate: 'web-lint',
  rule: 'porcelain(web-api-owns-request)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/web/src/features/access/commands/pairing.ts',
      content:
        "import { HttpApiClient as directClient } from 'effect/http-api';\n",
    },
  ],
} satisfies Probe;
