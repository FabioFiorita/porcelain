import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script tests a promise as a condition',
  gate: 'lint',
  rule: 'typescript(no-misused-promises)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeMisuse(): number {\n  return Promise.resolve(1) ? 1 : 0;\n}\n',
    },
  ],
} satisfies Probe;
