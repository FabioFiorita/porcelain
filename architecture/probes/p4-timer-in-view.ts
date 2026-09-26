import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view schedules work with setTimeout',
  gate: 'web-lint',
  rule: 'porcelain(web-timers-in-commands-and-store)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeLater(done: () => void) {\n  setTimeout(done);\n}\n',
    },
  ],
} satisfies Probe;
