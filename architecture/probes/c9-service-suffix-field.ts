import type { Probe } from '../probe.ts';

export default {
  decision: 'C9',
  plants:
    'use-cases/access/read-health.ts: field renamed readEnvironmentService',
  gate: 'lint',
  rule: 'porcelain(naming)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'private readonly readEnvironment:',
      new: 'private readonly readEnvironmentService:',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'this.readEnvironment = readEnvironment;',
      new: 'this.readEnvironmentService = readEnvironment;',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'this.readEnvironment.execute()',
      new: 'this.readEnvironmentService.execute()',
    },
  ],
} satisfies Probe;
