import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'the only import of cmdk removed while apps/web/package.json still depends on it',
  gate: 'arch',
  rule: 'unused-dependency:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/components/ui/command.tsx',
      old: "import { Command as CommandPrimitive } from 'cmdk';\n",
      new: '',
    },
  ],
} satisfies Probe;
