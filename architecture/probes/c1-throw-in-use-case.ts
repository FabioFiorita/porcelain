import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'use-cases/changes/read-change-lines.ts decides the range itself and throws InvalidLineRangeError instead of calling the service',
  gate: 'lint',
  rule: 'porcelain(use-case-computes)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/use-cases/changes/read-change-lines.ts',
      content: `import { InvalidLineRangeError } from '@porcelain/kernel/errors';
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/changes/read-change-lines.ts',
      old: `        const lines = this.readChangeLines.execute({`,
      new: `        if (from > to) throw new InvalidLineRangeError();
        const lines = this.readChangeLines.execute({`,
    },
  ],
} satisfies Probe;
