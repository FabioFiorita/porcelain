import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    'http/routes/changes/read-changes.ts: route option preHandler: async () => undefined',
  gate: 'lint',
  rule: 'porcelain(feature-route-registrations)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/changes/read-changes.ts',
      old: `    {
      schema: {
        params: worktreeParamsSchema,`,
      new: `    {
      preHandler: async () => undefined,
      schema: {
        params: worktreeParamsSchema,`,
    },
  ],
} satisfies Probe;
