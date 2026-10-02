import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the server control CLI writes evidence without the kit redaction, so the leak guard withholds the exchange it should keep',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'AssertionError: redacted evidence keeps the exchange',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/instance.ts',
      old: 'const redacted = recorder.redact(record);',
      new: 'const redacted = record;',
    },
  ],
} satisfies Probe;
