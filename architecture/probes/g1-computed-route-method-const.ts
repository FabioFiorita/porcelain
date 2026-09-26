import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "http/routes/access/read-health.ts: const method = 'get'; api[method](...)",
  gate: 'lint',
  rule: 'porcelain(feature-route-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: `  api.get(
`,
      new: `  const METHOD = 'get';
  api[METHOD](
`,
    },
  ],
} satisfies Probe;
