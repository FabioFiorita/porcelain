import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'installer/service-health.ts waits a literal 60 attempts again instead of the attempts its context carries',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/installer/service-health.ts',
      old: 'attempt < options.attempts;',
      new: 'attempt < 60;',
    },
  ],
} satisfies Probe;
