import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a fixture file in runtime web code',
  gate: 'arch',
  rule: 'web-no-runtime-fixture:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/fixture-session.ts',
      content: "export const probe = 'probe';\n",
    },
  ],
} satisfies Probe;
