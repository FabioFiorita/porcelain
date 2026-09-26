import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a feature rule exports a function nothing imports',
  gate: 'arch',
  rule: 'unused-export:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/rules/probe-rule.ts',
      content: "export function probeUnused() {\n  return 'probe';\n}\n",
    },
  ],
} satisfies Probe;
