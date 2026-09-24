import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a projects service file not named *-service.ts',
  gate: 'arch',
  rule: 'service-file-name:',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/services/probe.ts',
      content: '',
    },
  ],
} satisfies Probe;
