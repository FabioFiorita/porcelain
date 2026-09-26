import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a query file re-exports a pure error decision',
  gate: 'web-lint',
  rule: 'porcelain(web-queries-export-reads)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/queries/probe-query.ts',
      content:
        "export { connectionErrorMessage } from '../rules/connection-error-message';\n",
    },
  ],
} satisfies Probe;
