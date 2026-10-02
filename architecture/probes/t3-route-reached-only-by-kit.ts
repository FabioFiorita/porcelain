import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the only tests that reach GET /api/git/commit-models send it as kit setup calls, so no request of a test of its own reaches the route',
  gate: 'integration',
  rule: 'Error: Route coverage: no integration test requested GET /api/git/commit-models;',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/spec/integration/git-actions-list-commit-models.integration.ts',
      old: "    path: '/api/git/commit-models',\n  });\n",
      new: "    path: '/api/git/commit-models',\n    headers: { 'x-porcelain-journey': 'kit' },\n  });\n",
      all: true,
    },
  ],
} satisfies Probe;
