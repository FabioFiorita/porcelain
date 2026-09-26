import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script returns a parsed any',
  gate: 'lint',
  rule: 'typescript(no-unsafe-return)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeReturn(text: string): string {\n  return JSON.parse(text);\n}\n',
    },
  ],
} satisfies Probe;
