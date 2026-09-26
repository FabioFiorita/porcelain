import type { Probe } from '../probe.ts';

export default {
  decision: 'C8',
  plants:
    'use-cases/changes/read-changes.ts: changes: changes.slice(0, 2000) inside the read lane',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/changes/read-changes.ts',
      old: `          changes,
          ...(interrupted`,
      new: `          changes: changes.slice(0, 2000),
          ...(interrupted`,
    },
  ],
} satisfies Probe;
