import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'a health test sends a request it never reads, so a setup step could fail and the test still pass',
  gate: 'integration',
  feature: 'access-health',
  rule: 'Error: The test sent GET /api/health and never read the status;',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/spec/integration/access-health.integration.ts',
      old: '  const before = await inventory(session);\n',
      new: "  const before = await inventory(session);\n  await session.send({ method: 'GET', path: '/api/health', auth: 'none' });\n",
    },
  ],
} satisfies Probe;
