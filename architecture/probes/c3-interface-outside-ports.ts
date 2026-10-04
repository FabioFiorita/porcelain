import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants:
    'a service file declares an interface instead of importing its contract',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/src/services/probe-options-service.ts',
      content: 'export interface ProbeOptions { path: string; }\n',
    },
  ],
} satisfies Probe;
