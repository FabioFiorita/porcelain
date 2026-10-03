import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the only integration test that requests GET /api/git/commit-models is deleted, so a registered route goes unrequested',
  gate: 'integration',
  rule: 'Error: Route coverage: no integration test requested GET /api/git/commit-models;',
  edits: [
    {
      kind: 'delete',
      path: 'apps/server/spec/integration/git-actions-list-commit-models.integration.ts',
    },
  ],
} satisfies Probe;
