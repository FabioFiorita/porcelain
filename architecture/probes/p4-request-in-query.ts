import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a query imports the shared request function instead of calling api.ts',
  gate: 'web-lint',
  rule: 'porcelain(web-api-owns-request)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/queries/probe-query.ts',
      content:
        "import { requestJson } from '@/shared/api/request';\n\nexport const probeRequest = requestJson;\n",
    },
  ],
} satisfies Probe;
