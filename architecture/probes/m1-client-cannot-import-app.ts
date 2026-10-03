import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'a shared client rule reaches back into the web app',
  gate: 'arch',
  rule: 'client-imports-client-and-contracts-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/rules/pairing-link.ts',
      content:
        "import '../../../../../../apps/web/src/features/access/rules/remotes.ts';\n",
    },
  ],
} satisfies Probe;
