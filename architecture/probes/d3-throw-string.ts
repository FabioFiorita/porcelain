import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script throws a string',
  gate: 'lint',
  rule: 'typescript(only-throw-error)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content: 'export function probeThrow(): never {\n  throw "probe";\n}\n',
    },
  ],
} satisfies Probe;
