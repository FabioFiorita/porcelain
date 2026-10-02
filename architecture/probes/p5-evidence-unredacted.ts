import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the kit saves the steps it recorded without redacting them, so a credential reaches the evidence',
  gate: 'web-verify',
  feature: 'apps/web/spec/e2e/protections.e2e.ts',
  rule: 'Expected substring: "[redacted]"',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/spec/kit/world.ts',
      old: 'JSON.stringify(this.recorder.redact(this.recorder.steps), null, 2)',
      new: 'JSON.stringify(this.recorder.steps, null, 2)',
    },
  ],
} satisfies Probe;
