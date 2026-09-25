import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a query file defines a mutation',
  gate: 'web-lint',
  rule: 'porcelain(web-commands-own-writes)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/queries/probe-query.ts',
      content:
        "import { useMutation } from '@tanstack/react-query';\n\nexport function useProbeWrite() {\n  return useMutation({ mutationFn: async () => undefined });\n}\n",
    },
  ],
} satisfies Probe;
