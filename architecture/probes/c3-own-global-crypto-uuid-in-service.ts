import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'access/services/issue-pairing-service.ts: credential id from the global crypto.randomUUID() (no import)',
  gate: 'lint',
  rule: 'typescript(no-unsafe-call)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: `        this.idSource.next(),
        this.secretSource.next(),`,
      new: `        crypto.randomUUID(),
        this.secretSource.next(),`,
    },
  ],
} satisfies Probe;
