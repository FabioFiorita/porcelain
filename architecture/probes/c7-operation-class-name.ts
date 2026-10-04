import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'an operation class name disagrees with its file and role',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'export class ReadHealthUseCase',
      new: 'export class ReadHealthController',
    },
  ],
} satisfies Probe;
