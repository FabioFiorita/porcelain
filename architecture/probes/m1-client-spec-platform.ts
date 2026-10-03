import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'a portable client spec imports a native platform view',
  gate: 'lint',
  rule: 'porcelain(spec-imports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/commands/pairing.spec.ts',
      content:
        "import '../../../../../../apps/mobile/src/features/access/views/settings-screen.tsx';\n",
    },
  ],
} satisfies Probe;
