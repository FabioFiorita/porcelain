import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'the native access route imports a domain service as its health use case',
  gate: 'arch',
  rule: 'transport-cannot-import-domain-api:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/access-api.ts',
      old: "import { type ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';",
      new: "import { type ReadEnvironmentService as ReadHealthUseCase } from '@porcelain/access/services';",
    },
  ],
} satisfies Probe;
