import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script reads a member of a parsed any',
  gate: 'lint',
  rule: 'typescript(no-unsafe-member-access)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'export function probeMember(text: string): unknown {\n  return JSON.parse(text).name;\n}\n',
    },
  ],
} satisfies Probe;
