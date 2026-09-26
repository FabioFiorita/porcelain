import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'access/services/issue-pairing-service.ts: grant id: crypto.randomUUID() (global, no import)',
  gate: 'typecheck',
  rule: 'error TS2304',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: '        id: code.id,',
      new: '        id: crypto.randomUUID(),',
    },
  ],
} satisfies Probe;
