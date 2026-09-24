import type { Probe } from '../probe.ts';

export default {
  decision: 'V2',
  plants:
    'bootstrap/compose-server.ts: everyMs: limits.jobs.refreshInventoryMs || 60_000',
  gate: 'lint',
  rule: 'porcelain(bootstrap-starts-nothing)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: 'everyMs: limits.jobs.refreshInventoryMs }',
      new: 'everyMs: limits.jobs.refreshInventoryMs || 60_000 }',
    },
  ],
} satisfies Probe;
