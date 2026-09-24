import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'git-actions/services/accept-git-action-service.ts: acceptedAt: new Date(Date.parse(this.clock.now())).toISOString()',
  gate: 'lint',
  rule: 'porcelain(one-clock)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/accept-git-action-service.ts',
      old: '      acceptedAt: this.clock.now(),',
      new: '      acceptedAt: new Date(Date.parse(this.clock.now())).toISOString(),',
    },
  ],
} satisfies Probe;
