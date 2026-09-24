import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'http/routes/access/read-health.ts: options.useCase typed as Pick<ReadEnvironmentService> imported from @porcelain/access/services',
  gate: 'arch',
  rule: 'transport-cannot-import-domain-api:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: "import type { ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';",
      new: "import type { ReadEnvironmentService } from '@porcelain/access/services';",
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: "Pick<ReadHealthUseCase, 'execute'>",
      new: "Pick<ReadEnvironmentService, 'execute'>",
    },
  ],
} satisfies Probe;
