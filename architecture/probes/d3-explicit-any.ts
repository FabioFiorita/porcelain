import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script function returning any',
  gate: 'lint',
  rule: 'typescript(no-explicit-any)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeWiden(value: unknown): any {\n  return value;\n}\n',
    },
  ],
} satisfies Probe;
