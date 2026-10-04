import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants:
    'an operation result model uses a primitive instead of the model convention',
  gate: 'lint',
  rule: 'porcelain(models-file-shape)',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/src/models/probe-result.ts',
      content: 'export type ProbeResult = string;\n',
    },
  ],
} satisfies Probe;
