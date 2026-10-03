import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script starts a promise and drops it',
  gate: 'lint',
  rule: 'typescript(no-floating-promises)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export async function probeFloat(): Promise<void> {\n  Promise.resolve(1);\n}\n',
    },
  ],
} satisfies Probe;
