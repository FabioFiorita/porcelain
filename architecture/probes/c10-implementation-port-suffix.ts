import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'an implementation name no longer ends in the port it implements',
  gate: 'lint',
  rule: 'porcelain(implementation-name)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/runtime/system-clock.ts',
      old: 'export class SystemClock',
      new: 'export class SystemClockAdapter',
    },
  ],
} satisfies Probe;
