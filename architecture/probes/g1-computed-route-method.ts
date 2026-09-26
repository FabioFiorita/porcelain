import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "http/routes/access/read-health.ts: api['get'](...) instead of api.get",
  gate: 'lint',
  rule: 'porcelain(feature-route-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: `  api.get(
`,
      new: `  api['get'](
`,
    },
  ],
} satisfies Probe;
