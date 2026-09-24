import type { Probe } from '../probe.ts';

export default {
  decision: 'C9',
  plants:
    'use-cases/access/read-health.ts: field `private readEnvironmentService` (not readonly)',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'private readonly readEnvironment:',
      new: 'private readEnvironmentService:',
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
