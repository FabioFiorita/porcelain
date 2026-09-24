import type { Probe } from '../probe.ts';

export default {
  decision: 'C9',
  plants: 'access/rules/credential.ts: ID_PATTERN renamed idPattern',
  gate: 'lint',
  rule: 'porcelain(naming)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/rules/credential.ts',
      old: 'ID_PATTERN',
      new: 'idPattern',
      all: true,
    },
  ],
} satisfies Probe;
