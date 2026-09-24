import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a use case under use-cases/probe/, an area that is not a domain',
  gate: 'arch',
  rule: 'use-case-file-name:',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/use-cases/probe/read-probe.ts',
      content: '',
    },
  ],
} satisfies Probe;
