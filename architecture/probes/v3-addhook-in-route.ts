import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    "http/routes/changes/read-changes.ts: api.addHook('preHandler', ...) before api.get",
  gate: 'lint',
  rule: 'porcelain(feature-route-registrations)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/changes/read-changes.ts',
      old: `  api.get(
`,
      new: `  api.addHook('preHandler', async () => undefined);
  api.get(
`,
    },
  ],
} satisfies Probe;
