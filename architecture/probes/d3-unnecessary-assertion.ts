import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script asserts a string to string',
  gate: 'lint',
  rule: 'typescript(no-unnecessary-type-assertion)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeAssert(value: string): string {\n  return value as string;\n}\n',
    },
  ],
} satisfies Probe;
