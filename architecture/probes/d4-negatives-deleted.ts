import type { Probe } from '../probe.ts';

export default {
  decision: 'P28',
  plants:
    'both negative features deleted, so the net would report 0/0 negatives rejected',
  gate: 'verify',
  rule: 'negatives: negative/ holds fewer negative features than the net records',
  edits: [
    {
      kind: 'delete',
      path: '.agents/skills/server-verify/negative/disguised.ts',
    },
    { kind: 'delete', path: '.agents/skills/server-verify/negative/hollow.ts' },
  ],
} satisfies Probe;
