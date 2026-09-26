import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'runtime/delay.ts imports a module by a computed name',
  gate: 'lint',
  rule: 'porcelain(static-imports)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/src/runtime/delay.ts',
      content:
        '\nexport function probeLoad(name: string): Promise<unknown> {\n  return import(name);\n}\n',
    },
  ],
} satisfies Probe;
