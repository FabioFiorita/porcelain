import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature folder for a domain the web does not have',
  gate: 'arch',
  rule: 'unclassified-source:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/billing/index.ts',
      content: "export const probe = 'probe';\n",
    },
  ],
} satisfies Probe;
