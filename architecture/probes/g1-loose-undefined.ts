import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'access/services/issue-pairing-service.ts: detail() checks `value == undefined` (no null literal)',
  gate: 'lint',
  rule: 'porcelain(no-loose-equality-in-domain)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: '    if (value === undefined) throw new InvalidDeviceDetailsError();',
      new: '    if (value == undefined) throw new InvalidDeviceDetailsError();',
    },
  ],
} satisfies Probe;
