import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a web dependency nothing imports',
  gate: 'arch',
  rule: 'unused-dependency:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/package.json',
      old: '"@base-ui/react": "1.8.0",',
      new: '"@base-ui/react": "1.8.0",\n    "left-pad": "1.3.0",',
    },
  ],
} satisfies Probe;
