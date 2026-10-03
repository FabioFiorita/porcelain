import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'native transport defines a request limit outside its config owner',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/mobile/src/shared/api/transport.ts',
      old: 'AbortSignal.timeout(REQUEST_TIMEOUT_MS)',
      new: 'AbortSignal.timeout(15_000)',
    },
  ],
} satisfies Probe;
