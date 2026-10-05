import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'runtime declares a contract instead of consuming a server port',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/probe-delay.ts',
      content:
        'export interface ProbeDelay { readonly milliseconds: string; }\n',
    },
  ],
} satisfies Probe;
