import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a query reads localStorage instead of the feature store',
  gate: 'web-lint',
  rule: 'porcelain(web-store-owns-storage)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/queries/probe-query.ts',
      content:
        "export function probeSaved() {\n  return localStorage.getItem('probe');\n}\n",
    },
  ],
} satisfies Probe;
