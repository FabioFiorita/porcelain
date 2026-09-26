import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script imports a class it uses only as a type',
  gate: 'lint',
  rule: 'typescript(consistent-type-imports)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-typescript.ts',
      content:
        'import { Readable } from "node:stream";\n\nexport function probeStream(value: Readable): Readable {\n  return value;\n}\n',
    },
  ],
} satisfies Probe;
