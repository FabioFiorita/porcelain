import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'an unused export in the desktop owner escapes the architecture inventory',
  gate: 'arch',
  rule: 'unused-export:',
  edits: [
    {
      kind: 'create',
      path: 'apps/desktop/src/unread.ts',
      content: 'export const unread = true;\n',
    },
  ],
} satisfies Probe;
