import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a web view hard-codes a delay instead of reading it from a limits file',
  gate: 'web-lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content: 'export const probeDelay = 250;\n',
    },
  ],
} satisfies Probe;
