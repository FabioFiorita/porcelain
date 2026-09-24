import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script assigns a parsed any to a variable',
  gate: 'lint',
  rule: 'typescript(no-unsafe-assignment)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeAssign(text: string): string {\n  const value = JSON.parse(text);\n  return String(value);\n}\n',
    },
  ],
} satisfies Probe;
