import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script narrows a union with as',
  gate: 'lint',
  rule: 'typescript(no-unsafe-type-assertion)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeNarrow(value: string | number): number {\n  return value as number;\n}\n',
    },
  ],
} satisfies Probe;
