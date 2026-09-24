import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script passes a parsed any to Math.abs',
  gate: 'lint',
  rule: 'typescript(no-unsafe-argument)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeArgument(text: string): number {\n  return Math.abs(JSON.parse(text));\n}\n',
    },
  ],
} satisfies Probe;
