import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'use-cases/access/read-health.ts: class renamed ReadHealthController (all references renamed too)',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'ReadHealthUseCase',
      new: 'ReadHealthController',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/access/read-health.ts',
      old: 'ReadHealthUseCase',
      new: 'ReadHealthController',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/scopes/public.ts',
      old: 'ReadHealthUseCase',
      new: 'ReadHealthController',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-access.ts',
      old: 'ReadHealthUseCase',
      new: 'ReadHealthController',
      all: true,
    },
  ],
} satisfies Probe;
