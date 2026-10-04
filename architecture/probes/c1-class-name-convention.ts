import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'a class name stops following PascalCase',
  gate: 'lint',
  rule: 'porcelain(naming)',
  edits: [
    {
      kind: 'create',
      path: 'packages/access/src/rules/probe-name.ts',
      content: 'export class probeReader {}\n',
    },
  ],
} satisfies Probe;
