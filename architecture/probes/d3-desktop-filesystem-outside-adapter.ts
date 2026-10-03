import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'the desktop main process imports filesystem operations outside its adapter',
  gate: 'arch',
  rule: 'desktop-cannot-import-external:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/desktop/src/main.ts',
      content: "import { readFileSync } from 'node:fs';\n",
    },
  ],
} satisfies Probe;
