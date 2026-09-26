import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a command builds a query key literal instead of reading it from the factory',
  gate: 'web-lint',
  rule: 'porcelain(web-queries-own-reads)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/commands/probe-command.ts',
      content:
        "export const probeInvalidation = { queryKey: ['access', 'session'] };\n",
    },
  ],
} satisfies Probe;
