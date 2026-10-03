import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a web code file outside src/ and spec/',
  gate: 'arch',
  rule: 'code-outside-roots:',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/tools/probe.ts',
      content: "export const probe = 'probe';\n",
    },
  ],
} satisfies Probe;
