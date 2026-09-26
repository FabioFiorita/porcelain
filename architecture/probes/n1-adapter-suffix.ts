import type { Probe } from '../probe.ts';

export default {
  decision: 'N1',
  plants:
    'adapters/runtime/system-clock.ts: class renamed SystemClockAdapter implements Clock (references renamed)',
  gate: 'lint',
  rule: 'porcelain(implementation-name)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/runtime/system-clock.ts',
      old: 'class SystemClock ',
      new: 'class SystemClockAdapter ',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/compose-server.ts',
      old: 'SystemClock',
      new: 'SystemClockAdapter',
      all: true,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/bootstrap/main.ts',
      old: 'SystemClock',
      new: 'SystemClockAdapter',
      all: true,
    },
  ],
} satisfies Probe;
