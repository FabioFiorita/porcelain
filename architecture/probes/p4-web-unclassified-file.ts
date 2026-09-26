import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a helpers file loose in a feature folder, outside its fixed parts',
  gate: 'arch',
  rule: 'unclassified-source:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/helpers.ts',
      content: "export const probe = 'probe';\n",
    },
  ],
} satisfies Probe;
