import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core writes evidence without the kit redaction, so the leak guard withholds the exchange it should keep',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'AssertionError: redacted evidence keeps the exchange',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/verify-core/evidence.ts',
      old: 'JSON.stringify(recorder.redact(record), null, 2)',
      new: 'JSON.stringify(record, null, 2)',
    },
  ],
} satisfies Probe;
